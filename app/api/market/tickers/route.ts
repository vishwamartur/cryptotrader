import { NextRequest, NextResponse } from 'next/server';

// Cache for tickers data
let tickersCache: Map<string, any> = new Map();
let cacheTimestamp = 0;
const CACHE_DURATION = 10 * 1000; // 10 seconds for real-time data

// Delta Exchange API endpoints
const DELTA_API_BASE = 'https://api.delta.exchange';

interface DeltaTicker {
  close: number;
  high: number;
  low: number;
  open: number;
  product_id: number;
  size: number;
  symbol: string;
  timestamp: number;
  turnover: number;
  turnover_symbol: string;
  turnover_usd: number;
  volume: number;
  change: number;
  price_change_percent_24h: number;
  best_bid: string;
  best_ask: string;
  best_bid_size: string;
  best_ask_size: string;
  spot_price: number;
  mark_price: number;
  open_interest: string;
  oi_change_24h: number;
  oi_change_percent_24h: number;
  funding_rate: number;
  predicted_funding_rate: number;
  next_funding_realization: number;
  basis: number;
  basis_percentage: number;
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
}

interface DeltaTickersResponse {
  success: boolean;
  result: DeltaTicker[];
}

async function fetchAllTickers(): Promise<DeltaTicker[]> {
  try {
    const response = await fetch(`${DELTA_API_BASE}/v2/tickers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoTrader/1.0',
      },
      next: { revalidate: 10 }, // Cache for 10 seconds
    });

    if (!response.ok) {
      throw new Error(`Delta Exchange API error: ${response.status} ${response.statusText}`);
    }

    const data: DeltaTickersResponse = await response.json();

    if (!data.success) {
      throw new Error('Delta Exchange API returned unsuccessful response');
    }

    return data.result;
  } catch (error) {
    console.error('Error fetching tickers from Delta Exchange:', error);
    throw error;
  }
}

async function fetchSpecificTickers(symbols: string[]): Promise<DeltaTicker[]> {
  const tickerPromises = symbols.map(async (symbol) => {
    try {
      const response = await fetch(`${DELTA_API_BASE}/v2/tickers/${symbol}`, {
        headers: {
          'User-Agent': 'CryptoTrader/1.0',
        },
        next: { revalidate: 10 }, // Cache for 10 seconds
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ticker for ${symbol}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error(`Error fetching ticker for ${symbol}:`, error);
      return null;
    }
  });

  const tickers = await Promise.all(tickerPromises);
  return tickers.filter((ticker) => ticker !== null);
}

function transformTickersForClient(tickers: DeltaTicker[]) {
  return tickers.map(ticker => ({
    symbol: ticker.symbol,
    productId: ticker.product_id,
    price: ticker.close,
    markPrice: ticker.mark_price,
    spotPrice: ticker.spot_price,
    change: ticker.change,
    changePercent: ticker.price_change_percent_24h,
    high24h: ticker.high,
    low24h: ticker.low,
    volume: ticker.volume,
    turnover: ticker.turnover,
    turnoverUsd: ticker.turnover_usd,
    bestBid: parseFloat(ticker.best_bid),
    bestAsk: parseFloat(ticker.best_ask),
    bestBidSize: parseFloat(ticker.best_bid_size),
    bestAskSize: parseFloat(ticker.best_ask_size),
    openInterest: parseFloat(ticker.open_interest),
    oiChange24h: ticker.oi_change_24h,
    oiChangePercent24h: ticker.oi_change_percent_24h,
    fundingRate: ticker.funding_rate,
    predictedFundingRate: ticker.predicted_funding_rate,
    nextFundingRealization: ticker.next_funding_realization,
    basis: ticker.basis,
    basisPercentage: ticker.basis_percentage,
    timestamp: ticker.timestamp,
    // Options Greeks (if available)
    iv: ticker.iv,
    delta: ticker.delta,
    gamma: ticker.gamma,
    theta: ticker.theta,
    vega: ticker.vega,
    rho: ticker.rho,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')?.split(',') || [];
    const limit = parseInt(searchParams.get('limit') || '50');
    const now = Date.now();

    // If specific symbols are requested
    if (symbols.length > 0 && symbols[0] !== '') {
      const tickers = await fetchSpecificTickers(symbols);
      const transformedTickers = transformTickersForClient(tickers);

      return NextResponse.json({
        success: true,
        result: transformedTickers,
        cached: false,
        totalTickers: transformedTickers.length,
        requestedSymbols: symbols,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Check cache for all tickers
    if (tickersCache.size > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      const cachedTickers = Array.from(tickersCache.values()).slice(0, limit);
      return NextResponse.json({
        success: true,
        result: cachedTickers,
        cached: true,
        cacheAge: Math.floor((now - cacheTimestamp) / 1000),
        totalTickers: cachedTickers.length,
      });
    }

    // Fetch fresh data for all tickers
    const tickers = await fetchAllTickers();
    const transformedTickers = transformTickersForClient(tickers);

    // Update cache
    tickersCache.clear();
    transformedTickers.forEach(ticker => {
      tickersCache.set(ticker.symbol, ticker);
    });
    cacheTimestamp = now;

    // Apply limit
    const limitedTickers = transformedTickers.slice(0, limit);

    return NextResponse.json({
      success: true,
      result: limitedTickers,
      cached: false,
      totalTickers: limitedTickers.length,
      totalAvailable: transformedTickers.length,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in tickers API:', error);

    // Return cached data if available, even if stale
    if (tickersCache.size > 0) {
      const cachedTickers = Array.from(tickersCache.values()).slice(0, parseInt(new URL(request.url).searchParams.get('limit') || '50'));
      return NextResponse.json({
        success: true,
        result: cachedTickers,
        cached: true,
        stale: true,
        error: 'Failed to fetch fresh data, returning cached data',
        cacheAge: Math.floor((Date.now() - cacheTimestamp) / 1000),
        totalTickers: cachedTickers.length,
      });
    }

    // Return fallback data if no cache available
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tickers from Delta Exchange',
      fallback: true,
      result: [
        {
          symbol: 'BTCUSD',
          productId: 27,
          price: 45000,
          change: 1000,
          changePercent: 2.27,
          volume: 1000000,
          high24h: 46000,
          low24h: 44000,
          bestBid: 44950,
          bestAsk: 45050,
          timestamp: Date.now()
        },
        {
          symbol: 'ETHUSD',
          productId: 139,
          price: 3000,
          change: 100,
          changePercent: 3.45,
          volume: 500000,
          high24h: 3100,
          low24h: 2900,
          bestBid: 2995,
          bestAsk: 3005,
          timestamp: Date.now()
        }
      ]
    }, { status: 500 });
  }
}
