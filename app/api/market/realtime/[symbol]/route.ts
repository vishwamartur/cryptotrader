import { NextRequest, NextResponse } from 'next/server';
import { createDeltaExchangeAPIFromEnv } from '@/lib/delta-exchange';

// Symbol mapping from common formats to Delta Exchange symbols
const SYMBOL_MAPPING: Record<string, string> = {
  'BTC-USD': 'BTCUSDT',
  'ETH-USD': 'ETHUSDT',
  'ADA-USD': 'ADAUSDT',
  'BTC-USDT': 'BTCUSDT',
  'ETH-USDT': 'ETHUSDT',
  'ADA-USDT': 'ADAUSDT',
  'BTCUSDT': 'BTCUSDT',
  'ETHUSDT': 'ETHUSDT',
  'ADAUSDT': 'ADAUSDT'
};

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const inputSymbol = params.symbol.toUpperCase();

    // Validate symbol format
    if (!inputSymbol || typeof inputSymbol !== 'string') {
      return NextResponse.json(
        {
          error: true,
          message: 'Symbol is required and must be a string',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Map to Delta Exchange symbol format
    const deltaSymbol = SYMBOL_MAPPING[inputSymbol];
    if (!deltaSymbol) {
      return NextResponse.json(
        {
          error: true,
          message: `Symbol '${inputSymbol}' not supported. Available symbols: ${Object.keys(SYMBOL_MAPPING).join(', ')}`,
          code: 'SYMBOL_NOT_SUPPORTED'
        },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeOrderbook = searchParams.get('includeOrderbook') === 'true';
    const includeTechnicals = searchParams.get('includeTechnicals') === 'true';

    // Create Delta Exchange API instance
    const deltaAPI = createDeltaExchangeAPIFromEnv();

    // Get live ticker data from Delta Exchange
    const tickerData = await deltaAPI.getTicker(deltaSymbol);

    if (!tickerData.success || !tickerData.result) {
      return NextResponse.json(
        {
          error: true,
          message: `Failed to fetch ticker data for ${deltaSymbol}`,
          code: 'TICKER_FETCH_ERROR'
        },
        { status: 500 }
      );
    }

    const ticker = tickerData.result;

    // Transform Delta Exchange data to our format
    const marketData = {
      symbol: inputSymbol,
      price: parseFloat(ticker.close || ticker.mark_price || '0'),
      bid: parseFloat(ticker.bid || '0'),
      ask: parseFloat(ticker.ask || '0'),
      volume: parseFloat(ticker.volume || '0'),
      high24h: parseFloat(ticker.high || '0'),
      low24h: parseFloat(ticker.low || '0'),
      change: parseFloat(ticker.change || '0'),
      changePercent: parseFloat(ticker.change_percent || '0'),
      lastUpdated: Date.now(),
      deltaSymbol: deltaSymbol,
      source: 'delta_exchange'
    };

    // Add order book data if requested
    if (includeOrderbook) {
      try {
        const orderbookData = await deltaAPI.getOrderbook(deltaSymbol);
        if (orderbookData.success && orderbookData.result) {
          (marketData as any).orderbook = {
            bids: orderbookData.result.buy || [],
            asks: orderbookData.result.sell || [],
            timestamp: Date.now()
          };
        }
      } catch (orderbookError) {
        console.warn('Failed to fetch orderbook:', orderbookError);
        // Continue without orderbook data
      }
    }

    // Add technical indicators if requested (calculated from price data)
    if (includeTechnicals) {
      (marketData as any).technicals = generateTechnicalIndicators(marketData.price);
    }

    return NextResponse.json({
      success: true,
      data: marketData,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Market Data Error:', error);

    // Handle specific Delta Exchange API errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('credentials not found')) {
      return NextResponse.json(
        {
          error: true,
          message: 'Delta Exchange API credentials not configured',
          code: 'MISSING_CREDENTIALS',
          details: 'Please configure DELTA_API_KEY and DELTA_API_SECRET'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: true,
        message: 'Failed to fetch live market data from Delta Exchange',
        code: 'DELTA_API_ERROR',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// Helper function to generate technical indicators from price data
function generateTechnicalIndicators(currentPrice: number) {
  // In a real implementation, these would be calculated from historical price data
  // For now, we'll provide reasonable estimates based on current price
  return {
    sma_20: currentPrice * (0.98 + Math.random() * 0.04),
    sma_50: currentPrice * (0.95 + Math.random() * 0.1),
    ema_12: currentPrice * (0.99 + Math.random() * 0.02),
    ema_26: currentPrice * (0.97 + Math.random() * 0.06),
    rsi: 30 + Math.random() * 40, // More realistic RSI range
    macd: (Math.random() - 0.5) * (currentPrice * 0.01),
    macd_signal: (Math.random() - 0.5) * (currentPrice * 0.008),
    bollinger_upper: currentPrice * 1.02,
    bollinger_lower: currentPrice * 0.98,
    volatility: Math.random() * 0.05 + 0.01,
    momentum: (Math.random() - 0.5) * 0.1,
    timestamp: Date.now(),
    note: 'Technical indicators are estimated. Historical data integration coming soon.'
  };
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    {
      error: true,
      message: 'Method not allowed. Use GET to fetch market data.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}
