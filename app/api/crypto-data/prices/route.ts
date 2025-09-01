import { NextRequest, NextResponse } from 'next/server';
import { cryptoAPIManager } from '@/lib/crypto-apis/api-manager';

/**
 * GET /api/crypto-data/prices
 * Fetch cryptocurrency prices from multiple providers with fallback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const provider = searchParams.get('provider');
    
    if (!symbolsParam) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing symbols parameter',
          message: 'Please provide symbols as comma-separated values (e.g., ?symbols=BTC,ETH,ADA)'
        },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    
    // Strictly validate symbols: accept only A-Z, 0-9, and underscores, max 10 chars per symbol
    const validSymbolPattern = /^[A-Z0-9_]{1,10}$/;
    if (
      symbols.length === 0 || 
      symbols.length > 50 || 
      symbols.some(symbol => !validSymbolPattern.test(symbol))
    ) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid symbols',
          message: 'Each symbol must be 1-10 characters, uppercase letters/numbers/underscore only'
        },
        { status: 400 }
      );
    }

    console.log(`Fetching prices for symbols: ${symbols.join(', ')}`);

    // Get prices from multiple providers
    const prices = await cryptoAPIManager.getPrices(symbols);
    
    // Get provider health status
    const providerHealth = await cryptoAPIManager.checkProvidersHealth();
    const providerStats = cryptoAPIManager.getProviderStats();

    return NextResponse.json({
      success: true,
      data: {
        prices,
        metadata: {
          totalSymbols: symbols.length,
          pricesFound: prices.length,
          timestamp: new Date().toISOString(),
          providers: {
            health: providerHealth,
            stats: providerStats
          }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cryptocurrency prices',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crypto-data/prices
 * Fetch prices with advanced filtering and options
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols, options = {} } = body;
    
    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          message: 'Please provide symbols as an array'
        },
        { status: 400 }
      );
    }

    const normalizedSymbols = symbols.map(s => s.toString().trim().toUpperCase());
    
    if (normalizedSymbols.length === 0 || normalizedSymbols.length > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid symbols count',
          message: 'Please provide 1-100 symbols'
        },
        { status: 400 }
      );
    }

    console.log(`POST: Fetching prices for ${normalizedSymbols.length} symbols with options:`, options);

    // Get prices
    const prices = await cryptoAPIManager.getPrices(normalizedSymbols);
    
    // Apply filtering if requested
    let filteredPrices = prices;
    
    if (options.minPrice) {
      filteredPrices = filteredPrices.filter(p => p.price >= options.minPrice);
    }
    
    if (options.maxPrice) {
      filteredPrices = filteredPrices.filter(p => p.price <= options.maxPrice);
    }
    
    if (options.minVolume) {
      filteredPrices = filteredPrices.filter(p => p.volume24h >= options.minVolume);
    }
    
    if (options.sortBy) {
      const sortField = options.sortBy;
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      
      filteredPrices.sort((a, b) => {
        const aVal = a[sortField as keyof typeof a] || 0;
        const bVal = b[sortField as keyof typeof b] || 0;
        return (aVal > bVal ? 1 : -1) * sortOrder;
      });
    }
    
    if (options.limit) {
      filteredPrices = filteredPrices.slice(0, options.limit);
    }

    // Calculate summary statistics
    const summary = {
      totalSymbols: normalizedSymbols.length,
      pricesFound: prices.length,
      filteredResults: filteredPrices.length,
      averagePrice: filteredPrices.reduce((sum, p) => sum + p.price, 0) / filteredPrices.length || 0,
      totalVolume24h: filteredPrices.reduce((sum, p) => sum + p.volume24h, 0),
      totalMarketCap: filteredPrices.reduce((sum, p) => sum + p.marketCap, 0),
      positiveChanges: filteredPrices.filter(p => p.changePercent24h > 0).length,
      negativeChanges: filteredPrices.filter(p => p.changePercent24h < 0).length
    };

    return NextResponse.json({
      success: true,
      data: {
        prices: filteredPrices,
        summary,
        metadata: {
          timestamp: new Date().toISOString(),
          options: options,
          providers: cryptoAPIManager.getProviderStats()
        }
      }
    });

  } catch (error) {
    console.error('Error in POST crypto prices:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cryptocurrency prices',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
