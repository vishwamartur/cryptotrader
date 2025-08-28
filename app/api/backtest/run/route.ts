import { NextRequest, NextResponse } from 'next/server';
import { QuantBacktester } from '@/lib/quant-backtester';
import {
  MovingAverageCrossoverStrategy,
  MeanReversionStrategy,
  MomentumStrategy,
  BreakoutStrategy
} from '@/lib/quant-strategy-engine';

// Strategy registry for backtesting
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
    const { 
      strategy, 
      data, 
      parameters = {
        transactionCost: 0.001,
        slippage: 0.0005,
        initialCapital: 10000
      }
    } = body;

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
          message: `Strategy '${strategy}' not found for backtesting. Available strategies: ${Object.keys(strategies).join(', ')}`,
          code: 'STRATEGY_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Validate data
    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        {
          error: true,
          message: 'Data is required and must be a non-empty array',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Validate data structure
    for (const item of data) {
      if (!item.symbol || typeof item.price !== 'number' || !item.timestamp) {
        return NextResponse.json(
          {
            error: true,
            message: 'Invalid data format. Each item must have symbol, price, and timestamp',
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
    }

    // Validate parameters
    const {
      transactionCost = 0.001,
      slippage = 0.0005,
      initialCapital = 10000
    } = parameters;

    if (typeof transactionCost !== 'number' || transactionCost < 0 || transactionCost > 0.1) {
      return NextResponse.json(
        {
          error: true,
          message: 'Transaction cost must be a number between 0 and 0.1',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    if (typeof slippage !== 'number' || slippage < 0 || slippage > 0.1) {
      return NextResponse.json(
        {
          error: true,
          message: 'Slippage must be a number between 0 and 0.1',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    if (typeof initialCapital !== 'number' || initialCapital <= 0) {
      return NextResponse.json(
        {
          error: true,
          message: 'Initial capital must be a positive number',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Get strategy class
    const StrategyClass = strategies[strategy as keyof typeof strategies];

    // Initialize backtester
    const backtester = new QuantBacktester(
      StrategyClass,
      transactionCost,
      slippage,
      initialCapital
    );

    // Record start time for performance measurement
    const startTime = Date.now();

    // Run backtest
    const results = backtester.runBacktest(data);

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    // Add metadata to results
    const enhancedResults = {
      ...results,
      metadata: {
        strategy: strategy,
        dataPoints: data.length,
        executionTime: executionTime,
        parameters: {
          transactionCost,
          slippage,
          initialCapital
        },
        dateRange: {
          start: new Date(Math.min(...data.map(d => d.timestamp))).toISOString(),
          end: new Date(Math.max(...data.map(d => d.timestamp))).toISOString()
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: enhancedResults,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Backtest Execution Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('insufficient data')) {
        return NextResponse.json(
          {
            error: true,
            message: 'Insufficient data for backtesting. Minimum 50 data points required.',
            code: 'INSUFFICIENT_DATA'
          },
          { status: 400 }
        );
      }

      if (error.message.includes('invalid strategy')) {
        return NextResponse.json(
          {
            error: true,
            message: 'Invalid strategy configuration',
            code: 'INVALID_STRATEGY'
          },
          { status: 400 }
        );
      }

      if (error.message.includes('memory')) {
        return NextResponse.json(
          {
            error: true,
            message: 'Dataset too large for backtesting. Please reduce data size.',
            code: 'DATASET_TOO_LARGE'
          },
          { status: 413 }
        );
      }
    }

    return NextResponse.json(
      {
        error: true,
        message: 'Internal server error during backtesting',
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
      message: 'Method not allowed. Use POST to run backtests.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}
