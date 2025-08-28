import { NextRequest, NextResponse } from 'next/server';
import { AITradingEngine } from '@/lib/ai-trading-engine';

// Initialize AI Trading Engine
const aiEngine = new AITradingEngine({
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096,
  temperature: 0.1,
  systemPrompt: 'You are an expert cryptocurrency trading analyst. Provide detailed market analysis and trading recommendations.'
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { marketData, positions = [], balance = 10000 } = body;

    // Validate required fields
    if (!marketData || !Array.isArray(marketData) || marketData.length === 0) {
      return NextResponse.json(
        { 
          error: true, 
          message: 'Market data is required and must be a non-empty array',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Validate market data structure
    for (const data of marketData) {
      if (!data.symbol || typeof data.price !== 'number' || !data.timestamp) {
        return NextResponse.json(
          {
            error: true,
            message: 'Invalid market data format. Each item must have symbol, price, and timestamp',
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
    }

    // Perform AI analysis
    const analysis = await aiEngine.analyzeMarket(marketData, positions, balance);

    // Return successful response
    return NextResponse.json({
      success: true,
      data: analysis,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('AI Analysis Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          {
            error: true,
            message: 'AI service configuration error',
            code: 'CONFIG_ERROR'
          },
          { status: 500 }
        );
      }

      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          {
            error: true,
            message: 'AI service rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED'
          },
          { status: 429 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      {
        error: true,
        message: 'Internal server error during AI analysis',
        code: 'INTERNAL_ERROR'
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
      message: 'Method not allowed. Use POST to analyze market data.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: true,
      message: 'Method not allowed. Use POST to analyze market data.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: true,
      message: 'Method not allowed. Use POST to analyze market data.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}
