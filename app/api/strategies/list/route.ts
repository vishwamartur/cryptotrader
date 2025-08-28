import { NextRequest, NextResponse } from 'next/server';

// Strategy definitions with metadata
const strategyDefinitions = [
  {
    name: 'MovingAverageCrossover',
    description: 'Simple moving average crossover strategy that generates buy/sell signals when short-term MA crosses above/below long-term MA',
    category: 'Trend Following',
    parameters: [
      { name: 'shortPeriod', type: 'number', default: 5, description: 'Short-term moving average period' },
      { name: 'longPeriod', type: 'number', default: 20, description: 'Long-term moving average period' }
    ],
    riskLevel: 'Medium',
    timeframe: ['1m', '5m', '15m', '1h', '4h', '1d'],
    complexity: 'Beginner'
  },
  {
    name: 'MeanReversion',
    description: 'Mean reversion strategy that identifies overbought/oversold conditions and trades against the trend',
    category: 'Mean Reversion',
    parameters: [
      { name: 'lookbackPeriod', type: 'number', default: 20, description: 'Lookback period for mean calculation' },
      { name: 'threshold', type: 'number', default: 2.0, description: 'Standard deviation threshold for signals' }
    ],
    riskLevel: 'Medium',
    timeframe: ['5m', '15m', '1h', '4h'],
    complexity: 'Intermediate'
  },
  {
    name: 'Momentum',
    description: 'Momentum strategy that follows strong price movements and trends',
    category: 'Momentum',
    parameters: [
      { name: 'period', type: 'number', default: 14, description: 'Momentum calculation period' },
      { name: 'threshold', type: 'number', default: 0.02, description: 'Momentum threshold for signals' }
    ],
    riskLevel: 'High',
    timeframe: ['15m', '1h', '4h', '1d'],
    complexity: 'Intermediate'
  },
  {
    name: 'Breakout',
    description: 'Breakout strategy that identifies price breakouts from support/resistance levels',
    category: 'Breakout',
    parameters: [
      { name: 'lookbackPeriod', type: 'number', default: 20, description: 'Lookback period for level identification' },
      { name: 'breakoutThreshold', type: 'number', default: 0.02, description: 'Breakout threshold percentage' }
    ],
    riskLevel: 'High',
    timeframe: ['15m', '1h', '4h', '1d'],
    complexity: 'Intermediate'
  }
];

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel');
    const complexity = searchParams.get('complexity');
    const timeframe = searchParams.get('timeframe');

    // Filter strategies based on query parameters
    let filteredStrategies = strategyDefinitions;

    if (category) {
      filteredStrategies = filteredStrategies.filter(
        strategy => strategy.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (riskLevel) {
      filteredStrategies = filteredStrategies.filter(
        strategy => strategy.riskLevel.toLowerCase() === riskLevel.toLowerCase()
      );
    }

    if (complexity) {
      filteredStrategies = filteredStrategies.filter(
        strategy => strategy.complexity.toLowerCase() === complexity.toLowerCase()
      );
    }

    if (timeframe) {
      filteredStrategies = filteredStrategies.filter(
        strategy => strategy.timeframe.includes(timeframe)
      );
    }

    // Get unique categories, risk levels, and complexity levels for metadata
    const metadata = {
      categories: [...new Set(strategyDefinitions.map(s => s.category))],
      riskLevels: [...new Set(strategyDefinitions.map(s => s.riskLevel))],
      complexityLevels: [...new Set(strategyDefinitions.map(s => s.complexity))],
      timeframes: [...new Set(strategyDefinitions.flatMap(s => s.timeframe))],
      totalStrategies: strategyDefinitions.length,
      filteredCount: filteredStrategies.length
    };

    return NextResponse.json({
      success: true,
      data: {
        strategies: filteredStrategies,
        metadata
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Strategy List Error:', error);

    return NextResponse.json(
      {
        error: true,
        message: 'Internal server error while fetching strategies',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    {
      error: true,
      message: 'Method not allowed. Use GET to list strategies.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}
