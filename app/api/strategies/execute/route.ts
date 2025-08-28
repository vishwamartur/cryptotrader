import { NextRequest, NextResponse } from 'next/server';
import {
  MovingAverageCrossoverStrategy,
  MeanReversionStrategy,
  MomentumStrategy,
  BreakoutStrategy
} from '@/lib/quant-strategy-engine';

// Strategy registry
const strategies = {
  'MovingAverageCrossover': MovingAverageCrossoverStrategy,
  'MeanReversion': MeanReversionStrategy,
  'Momentum': MomentumStrategy,
  'Breakout': BreakoutStrategy
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { strategy, data, parameters = {} } = body;

    // Validate strategy name
    if (!strategy || typeof strategy !== 'string') {
      return NextResponse.json(
        {
          error: true,
          message: 'Strategy name is required and must be a string',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Check if strategy exists
    if (!strategies[strategy as keyof typeof strategies]) {
      return NextResponse.json(
        {
          error: true,
          message: `Strategy '${strategy}' not found. Available strategies: ${Object.keys(strategies).join(', ')}`,
          code: 'STRATEGY_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        {
          error: true,
          message: 'Data is required and must be an object',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Get strategy class
    const StrategyClass = strategies[strategy as keyof typeof strategies];

    // Execute strategy
    const result = StrategyClass.run(data);

    // Add additional metadata
    const response = {
      ...result,
      strategy: strategy,
      parameters: parameters,
      timestamp: Date.now(),
      executionTime: Date.now() // In a real implementation, measure actual execution time
    };

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Strategy Execution Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('insufficient data')) {
        return NextResponse.json(
          {
            error: true,
            message: 'Insufficient data for strategy execution',
            code: 'INSUFFICIENT_DATA'
          },
          { status: 400 }
        );
      }

      if (error.message.includes('invalid parameters')) {
        return NextResponse.json(
          {
            error: true,
            message: 'Invalid strategy parameters',
            code: 'INVALID_PARAMETERS'
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: true,
        message: 'Internal server error during strategy execution',
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
      message: 'Method not allowed. Use POST to execute strategies.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}
