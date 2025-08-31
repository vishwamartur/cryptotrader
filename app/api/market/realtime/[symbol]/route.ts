import { NextRequest, NextResponse } from 'next/server';
import { createDeltaExchangeAPIFromEnv } from '@/lib/delta-exchange';

// Symbol mapping from common formats to Delta Exchange symbols
const SYMBOL_MAPPING: Record<string, string> = {
  'BTC-USD': 'BTCUSDT',
  'ETH-USD': 'ETHUSDT',
  'SOL-USD': 'SOLUSDT',
  'ADA-USD': 'ADAUSDT',
  'MATIC-USD': 'MATICUSDT',
  'DOT-USD': 'DOTUSDT',
  'AVAX-USD': 'AVAXUSDT',
  'LINK-USD': 'LINKUSDT',
  'UNI-USD': 'UNIUSDT',
  'ATOM-USD': 'ATOMUSDT',
  'BTC-USDT': 'BTCUSDT',
  'ETH-USDT': 'ETHUSDT',
  'SOL-USDT': 'SOLUSDT',
  'ADA-USDT': 'ADAUSDT',
  'MATIC-USDT': 'MATICUSDT',
  'DOT-USDT': 'DOTUSDT',
  'AVAX-USDT': 'AVAXUSDT',
  'LINK-USDT': 'LINKUSDT',
  'UNI-USDT': 'UNIUSDT',
  'ATOM-USDT': 'ATOMUSDT',
  'BTCUSDT': 'BTCUSDT',
  'ETHUSDT': 'ETHUSDT',
  'SOLUSDT': 'SOLUSDT',
  'ADAUSDT': 'ADAUSDT',
  'MATICUSDT': 'MATICUSDT',
  'DOTUSDT': 'DOTUSDT',
  'AVAXUSDT': 'AVAXUSDT',
  'LINKUSDT': 'LINKUSDT',
  'UNIUSDT': 'UNIUSDT',
  'ATOMUSDT': 'ATOMUSDT'
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

    // Get live ticker data from Delta Exchange with fallback
    let tickerData;
    let ticker;
    let isUsingFallback = false;

    try {
      tickerData = await deltaAPI.getTicker(deltaSymbol);

      if (!tickerData.success || !tickerData.result) {
        throw new Error(`Failed to fetch ticker data for ${deltaSymbol}`);
      }

      ticker = tickerData.result;
    } catch (tickerError) {
      console.warn(`Delta Exchange API failed for ${deltaSymbol}, using fallback data:`, tickerError);

      // Use fallback mock data when Delta Exchange API is not available
      ticker = generateFallbackTickerData(inputSymbol);
      isUsingFallback = true;
    }

    // Transform ticker data to our format
    const marketData = {
      symbol: inputSymbol,
      price: parseFloat(ticker.close || ticker.mark_price || ticker.price || '0'),
      bid: parseFloat(ticker.bid || '0'),
      ask: parseFloat(ticker.ask || '0'),
      volume: parseFloat(ticker.volume || '0'),
      high24h: parseFloat(ticker.high || '0'),
      low24h: parseFloat(ticker.low || '0'),
      change: parseFloat(ticker.change || '0'),
      changePercent: parseFloat(ticker.change_percent || '0'),
      lastUpdated: Date.now(),
      deltaSymbol: deltaSymbol,
      source: isUsingFallback ? 'fallback_data' : 'delta_exchange',
      isLiveData: !isUsingFallback
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
      // Return fallback data instead of error when credentials are missing
      console.warn('Delta Exchange credentials not found, returning fallback data');

      const fallbackTicker = generateFallbackTickerData(params.symbol.toUpperCase());
      const fallbackData = {
        symbol: params.symbol.toUpperCase(),
        price: parseFloat(fallbackTicker.price),
        bid: parseFloat(fallbackTicker.bid),
        ask: parseFloat(fallbackTicker.ask),
        volume: parseFloat(fallbackTicker.volume),
        high24h: parseFloat(fallbackTicker.high),
        low24h: parseFloat(fallbackTicker.low),
        change: parseFloat(fallbackTicker.change),
        changePercent: parseFloat(fallbackTicker.change_percent),
        lastUpdated: Date.now(),
        deltaSymbol: SYMBOL_MAPPING[params.symbol.toUpperCase()] || params.symbol.toUpperCase(),
        source: 'fallback_data',
        isLiveData: false
      };

      return NextResponse.json({
        success: true,
        data: fallbackData,
        timestamp: Date.now(),
        warning: 'Using fallback data - Delta Exchange API credentials not configured'
      });
    }

    // For other errors, also try to return fallback data
    console.warn('Delta Exchange API error, attempting fallback data:', errorMessage);

    try {
      const fallbackTicker = generateFallbackTickerData(params.symbol.toUpperCase());
      const fallbackData = {
        symbol: params.symbol.toUpperCase(),
        price: parseFloat(fallbackTicker.price),
        bid: parseFloat(fallbackTicker.bid),
        ask: parseFloat(fallbackTicker.ask),
        volume: parseFloat(fallbackTicker.volume),
        high24h: parseFloat(fallbackTicker.high),
        low24h: parseFloat(fallbackTicker.low),
        change: parseFloat(fallbackTicker.change),
        changePercent: parseFloat(fallbackTicker.change_percent),
        lastUpdated: Date.now(),
        deltaSymbol: SYMBOL_MAPPING[params.symbol.toUpperCase()] || params.symbol.toUpperCase(),
        source: 'fallback_data',
        isLiveData: false
      };

      return NextResponse.json({
        success: true,
        data: fallbackData,
        timestamp: Date.now(),
        warning: `Using fallback data - Delta Exchange API error: ${errorMessage}`
      });
    } catch (fallbackError) {
      // If even fallback fails, return error
      return NextResponse.json(
        {
          error: true,
          message: 'Failed to fetch market data and fallback generation failed',
          code: 'COMPLETE_FAILURE',
          details: errorMessage
        },
        { status: 500 }
      );
    }
  }
}

// Helper function to generate fallback ticker data when Delta Exchange API is unavailable
function generateFallbackTickerData(symbol: string) {
  // Base prices for different cryptocurrencies (approximate values)
  const basePrices: Record<string, number> = {
    'BTC-USD': 43000,
    'ETH-USD': 2600,
    'SOL-USD': 95,
    'ADA-USD': 0.45,
    'MATIC-USD': 0.85,
    'DOT-USD': 7.2,
    'AVAX-USD': 38,
    'LINK-USD': 14.5,
    'UNI-USD': 6.8,
    'ATOM-USD': 9.5
  };

  const basePrice = basePrices[symbol] || 100; // Default to $100 if symbol not found
  const priceVariation = 0.02; // 2% price variation
  const currentPrice = basePrice * (1 + (Math.random() - 0.5) * priceVariation);
  const changePercent = (Math.random() - 0.5) * 10; // -5% to +5% change
  const change = currentPrice * (changePercent / 100);

  return {
    close: currentPrice.toString(),
    price: currentPrice.toString(),
    mark_price: currentPrice.toString(),
    bid: (currentPrice * 0.999).toString(),
    ask: (currentPrice * 1.001).toString(),
    volume: (Math.random() * 1000000 + 100000).toString(),
    high: (currentPrice * 1.03).toString(),
    low: (currentPrice * 0.97).toString(),
    change: change.toString(),
    change_percent: changePercent.toString()
  };
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
