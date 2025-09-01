import { NextRequest, NextResponse } from 'next/server';
import { cryptoAPIManager } from '@/lib/crypto-apis/api-manager';

/**
 * GET /api/crypto-data/market
 * Fetch global cryptocurrency market data from multiple providers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHealth = searchParams.get('includeHealth') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';
    
    console.log('Fetching global market data...');

    // Get market data
    const marketData = await cryptoAPIManager.getMarketData();
    
    // Calculate additional metrics
    const additionalMetrics = {
      altcoinDominance: 100 - marketData.btcDominance,
      averageMarketCapPerCoin: marketData.totalMarketCap / marketData.activeCryptocurrencies,
      volumeToMarketCapRatio: (marketData.totalVolume24h / marketData.totalMarketCap) * 100,
      marketCapCategories: {
        large: Math.floor(marketData.activeCryptocurrencies * 0.01), // Top 1%
        medium: Math.floor(marketData.activeCryptocurrencies * 0.09), // Next 9%
        small: Math.floor(marketData.activeCryptocurrencies * 0.90) // Remaining 90%
      }
    };

    const response: any = {
      success: true,
      data: {
        ...marketData,
        additionalMetrics
      }
    };

    // Include provider health if requested
    if (includeHealth) {
      response.data.providerHealth = await cryptoAPIManager.checkProvidersHealth();
    }

    // Include provider stats if requested
    if (includeStats) {
      response.data.providerStats = cryptoAPIManager.getProviderStats();
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching market data:', error);
    
    // Return mock data if all providers fail
    const mockMarketData = {
      totalMarketCap: 2500000000000, // $2.5T
      totalVolume24h: 100000000000, // $100B
      btcDominance: 45.5,
      activeCryptocurrencies: 10000,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: {
        ...mockMarketData,
        additionalMetrics: {
          altcoinDominance: 100 - mockMarketData.btcDominance,
          averageMarketCapPerCoin: mockMarketData.totalMarketCap / mockMarketData.activeCryptocurrencies,
          volumeToMarketCapRatio: (mockMarketData.totalVolume24h / mockMarketData.totalMarketCap) * 100,
          marketCapCategories: {
            large: Math.floor(mockMarketData.activeCryptocurrencies * 0.01),
            medium: Math.floor(mockMarketData.activeCryptocurrencies * 0.09),
            small: Math.floor(mockMarketData.activeCryptocurrencies * 0.90)
          }
        },
        warning: 'Using mock data due to provider failures',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

/**
 * POST /api/crypto-data/market
 * Get market data with historical comparison
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timeframe = '24h', includeComparison = true } = body;
    
    console.log(`Fetching market data with timeframe: ${timeframe}`);

    // Get current market data
    const currentData = await cryptoAPIManager.getMarketData();
    
    // Mock historical data for comparison (in a real implementation, you'd fetch this from providers)
    const historicalData = {
      '24h': {
        totalMarketCap: currentData.totalMarketCap * 0.98, // 2% lower
        totalVolume24h: currentData.totalVolume24h * 1.15, // 15% higher
        btcDominance: currentData.btcDominance + 0.5,
        activeCryptocurrencies: currentData.activeCryptocurrencies
      },
      '7d': {
        totalMarketCap: currentData.totalMarketCap * 0.95, // 5% lower
        totalVolume24h: currentData.totalVolume24h * 1.25, // 25% higher
        btcDominance: currentData.btcDominance + 1.2,
        activeCryptocurrencies: currentData.activeCryptocurrencies - 10
      },
      '30d': {
        totalMarketCap: currentData.totalMarketCap * 0.88, // 12% lower
        totalVolume24h: currentData.totalVolume24h * 1.45, // 45% higher
        btcDominance: currentData.btcDominance + 2.8,
        activeCryptocurrencies: currentData.activeCryptocurrencies - 50
      }
    };

    const historical = historicalData[timeframe as keyof typeof historicalData] || historicalData['24h'];
    
    // Calculate changes
    const changes = {
      totalMarketCapChange: ((currentData.totalMarketCap - historical.totalMarketCap) / historical.totalMarketCap) * 100,
      totalVolumeChange: ((currentData.totalVolume24h - historical.totalVolume24h) / historical.totalVolume24h) * 100,
      btcDominanceChange: currentData.btcDominance - historical.btcDominance,
      activeCryptocurrenciesChange: currentData.activeCryptocurrencies - historical.activeCryptocurrencies
    };

    // Market sentiment based on changes
    const sentiment = {
      overall: changes.totalMarketCapChange > 5 ? 'bullish' : 
               changes.totalMarketCapChange < -5 ? 'bearish' : 'neutral',
      volume: changes.totalVolumeChange > 20 ? 'high' : 
              changes.totalVolumeChange < -20 ? 'low' : 'normal',
      dominance: changes.btcDominanceChange > 1 ? 'btc_gaining' : 
                 changes.btcDominanceChange < -1 ? 'alts_gaining' : 'stable'
    };

    const response = {
      success: true,
      data: {
        current: currentData,
        timeframe,
        changes,
        sentiment,
        analysis: {
          marketTrend: sentiment.overall,
          volumeTrend: sentiment.volume,
          dominanceTrend: sentiment.dominance,
          riskLevel: Math.abs(changes.totalMarketCapChange) > 10 ? 'high' : 
                     Math.abs(changes.totalMarketCapChange) > 5 ? 'medium' : 'low'
        }
      }
    };

    if (includeComparison) {
      response.data.historical = historical;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in POST market data:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market data with comparison',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
