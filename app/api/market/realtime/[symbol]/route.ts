import { NextRequest, NextResponse } from 'next/server';
import { EnhancedMarketDataProvider } from '@/lib/market-data-provider';

// Initialize market data provider
const marketDataProvider = new EnhancedMarketDataProvider();

// Mock market data for demonstration
// In a real implementation, this would come from actual exchange APIs
const mockMarketData = {
  'BTC-USD': {
    symbol: 'BTC-USD',
    price: 45000 + (Math.random() - 0.5) * 1000,
    bid: 44995,
    ask: 45005,
    volume: 1000000 + Math.random() * 500000,
    high24h: 46000,
    low24h: 44000,
    change: 500 + (Math.random() - 0.5) * 200,
    changePercent: 1.12 + (Math.random() - 0.5) * 0.5,
    lastUpdated: Date.now()
  },
  'ETH-USD': {
    symbol: 'ETH-USD',
    price: 3000 + (Math.random() - 0.5) * 100,
    bid: 2998,
    ask: 3002,
    volume: 500000 + Math.random() * 250000,
    high24h: 3100,
    low24h: 2950,
    change: 50 + (Math.random() - 0.5) * 20,
    changePercent: 1.67 + (Math.random() - 0.5) * 0.3,
    lastUpdated: Date.now()
  },
  'ADA-USD': {
    symbol: 'ADA-USD',
    price: 0.50 + (Math.random() - 0.5) * 0.05,
    bid: 0.499,
    ask: 0.501,
    volume: 10000000 + Math.random() * 5000000,
    high24h: 0.52,
    low24h: 0.48,
    change: 0.01 + (Math.random() - 0.5) * 0.005,
    changePercent: 2.0 + (Math.random() - 0.5) * 1.0,
    lastUpdated: Date.now()
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase();

    // Validate symbol format
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

    // Check if symbol is supported
    if (!mockMarketData[symbol as keyof typeof mockMarketData]) {
      return NextResponse.json(
        {
          error: true,
          message: `Symbol '${symbol}' not supported. Available symbols: ${Object.keys(mockMarketData).join(', ')}`,
          code: 'SYMBOL_NOT_SUPPORTED'
        },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeOrderbook = searchParams.get('includeOrderbook') === 'true';
    const includeTechnicals = searchParams.get('includeTechnicals') === 'true';

    // Get base market data
    let marketData = { ...mockMarketData[symbol as keyof typeof mockMarketData] };

    // Add slight randomization to simulate real-time updates
    marketData.price += (Math.random() - 0.5) * 10;
    marketData.bid = marketData.price - (Math.random() * 5 + 1);
    marketData.ask = marketData.price + (Math.random() * 5 + 1);
    marketData.volume += Math.random() * 10000;
    marketData.lastUpdated = Date.now();

    // Recalculate change and change percent
    const previousClose = marketData.price - marketData.change;
    marketData.change = marketData.price - previousClose;
    marketData.changePercent = (marketData.change / previousClose) * 100;

    // Add order book data if requested
    if (includeOrderbook) {
      (marketData as any).orderbook = generateMockOrderbook(marketData.price);
    }

    // Add technical indicators if requested
    if (includeTechnicals) {
      (marketData as any).technicals = generateMockTechnicals(marketData.price);
    }

    // Try to get real-time data from market data provider
    try {
      const realtimeData = await marketDataProvider.getRealtimeData(symbol);
      if (realtimeData) {
        // Merge real-time data with mock data
        marketData = { ...marketData, ...realtimeData };
      }
    } catch (providerError) {
      console.warn('Market data provider error, using mock data:', providerError);
    }

    return NextResponse.json({
      success: true,
      data: marketData,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Market Data Error:', error);

    return NextResponse.json(
      {
        error: true,
        message: 'Internal server error while fetching market data',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to generate mock order book
function generateMockOrderbook(currentPrice: number) {
  const bids = [];
  const asks = [];
  
  // Generate 10 levels of bids and asks
  for (let i = 0; i < 10; i++) {
    const bidPrice = currentPrice - (i + 1) * (Math.random() * 2 + 0.5);
    const askPrice = currentPrice + (i + 1) * (Math.random() * 2 + 0.5);
    const bidSize = Math.random() * 5 + 0.1;
    const askSize = Math.random() * 5 + 0.1;
    
    bids.push([Math.round(bidPrice * 100) / 100, Math.round(bidSize * 1000) / 1000]);
    asks.push([Math.round(askPrice * 100) / 100, Math.round(askSize * 1000) / 1000]);
  }
  
  return {
    bids: bids.sort((a, b) => b[0] - a[0]), // Sort descending
    asks: asks.sort((a, b) => a[0] - b[0]), // Sort ascending
    timestamp: Date.now()
  };
}

// Helper function to generate mock technical indicators
function generateMockTechnicals(currentPrice: number) {
  return {
    sma_20: currentPrice * (0.98 + Math.random() * 0.04),
    sma_50: currentPrice * (0.95 + Math.random() * 0.1),
    ema_12: currentPrice * (0.99 + Math.random() * 0.02),
    ema_26: currentPrice * (0.97 + Math.random() * 0.06),
    rsi: Math.random() * 100,
    macd: (Math.random() - 0.5) * 100,
    macd_signal: (Math.random() - 0.5) * 80,
    bollinger_upper: currentPrice * 1.02,
    bollinger_lower: currentPrice * 0.98,
    volume_sma: 1000000 + Math.random() * 500000,
    volatility: Math.random() * 0.05 + 0.01,
    momentum: (Math.random() - 0.5) * 0.1,
    timestamp: Date.now()
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
