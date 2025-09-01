import { NextRequest, NextResponse } from 'next/server';
import { santimentService } from '@/lib/crypto-apis/santiment-service';

/**
 * GET /api/crypto-data/onchain
 * Fetch cryptocurrency on-chain data from Santiment
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const days = parseInt(searchParams.get('days') || '1');
    const includeHealth = searchParams.get('includeHealth') === 'true';
    
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
    
    if (symbols.length === 0 || symbols.length > 10) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid symbols count',
          message: 'Please provide 1-10 symbols for on-chain analysis'
        },
        { status: 400 }
      );
    }

    if (days < 1 || days > 30) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid days parameter',
          message: 'Days must be between 1 and 30'
        },
        { status: 400 }
      );
    }

    console.log(`Fetching on-chain data for symbols: ${symbols.join(', ')}, days: ${days}`);

    // Get on-chain data
    const onChainData = await santimentService.getOnChainData(symbols, days);
    
    // Calculate aggregate metrics
    const aggregateMetrics = {
      totalSymbols: symbols.length,
      dataFound: onChainData.length,
      totalActiveAddresses: onChainData.reduce((sum, d) => sum + d.activeAddresses, 0),
      totalTransactionVolume: onChainData.reduce((sum, d) => sum + d.transactionVolume, 0),
      averageNetworkGrowth: onChainData.reduce((sum, d) => sum + d.networkGrowth, 0) / onChainData.length || 0,
      totalCirculation: onChainData.reduce((sum, d) => sum + d.circulation, 0),
      averageVelocity: onChainData.reduce((sum, d) => sum + d.velocity, 0) / onChainData.length || 0
    };

    const response: any = {
      success: true,
      data: {
        onChainData,
        aggregateMetrics,
        parameters: {
          symbols,
          days
        },
        timestamp: new Date().toISOString()
      }
    };

    // Include provider health if requested
    if (includeHealth) {
      response.data.santimentHealth = await santimentService.healthCheck();
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching on-chain data:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch on-chain data',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crypto-data/onchain
 * Advanced on-chain analysis with filtering and insights
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      symbols, 
      days = 7,
      metrics = ['activeAddresses', 'transactionVolume', 'networkGrowth'],
      minActiveAddresses = 0,
      includeInsights = true
    } = body;
    
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
    
    if (normalizedSymbols.length === 0 || normalizedSymbols.length > 20) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid symbols count',
          message: 'Please provide 1-20 symbols'
        },
        { status: 400 }
      );
    }

    if (days < 1 || days > 90) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid days parameter',
          message: 'Days must be between 1 and 90'
        },
        { status: 400 }
      );
    }

    console.log(`POST: Fetching on-chain data for ${normalizedSymbols.length} symbols over ${days} days`);

    // Get on-chain data
    let onChainData = await santimentService.getOnChainData(normalizedSymbols, days);
    
    // Apply filters
    if (minActiveAddresses > 0) {
      onChainData = onChainData.filter(d => d.activeAddresses >= minActiveAddresses);
    }

    // Filter by requested metrics
    const filteredData = onChainData.map(data => {
      const filtered: any = {
        symbol: data.symbol,
        lastUpdated: data.lastUpdated
      };

      if (metrics.includes('activeAddresses')) filtered.activeAddresses = data.activeAddresses;
      if (metrics.includes('transactionVolume')) filtered.transactionVolume = data.transactionVolume;
      if (metrics.includes('networkGrowth')) filtered.networkGrowth = data.networkGrowth;
      if (metrics.includes('circulation')) filtered.circulation = data.circulation;
      if (metrics.includes('velocity')) filtered.velocity = data.velocity;

      return filtered;
    });

    // Generate insights
    const insights = includeInsights ? generateOnChainInsights(onChainData) : [];

    return NextResponse.json({
      success: true,
      data: {
        onChainData: filteredData,
        insights,
        filters: {
          days,
          metrics,
          minActiveAddresses
        },
        metadata: {
          totalSymbols: normalizedSymbols.length,
          filteredResults: filteredData.length,
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error in POST on-chain analysis:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform on-chain analysis',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper functions
function generateOnChainInsights(onChainData: any[]) {
  const insights = [];
  
  // Most active networks
  const sortedByActiveAddresses = [...onChainData].sort((a, b) => b.activeAddresses - a.activeAddresses);
  if (sortedByActiveAddresses.length > 0) {
    insights.push({
      type: 'most_active_network',
      symbol: sortedByActiveAddresses[0].symbol,
      activeAddresses: sortedByActiveAddresses[0].activeAddresses,
      networkGrowth: sortedByActiveAddresses[0].networkGrowth
    });
  }
  
  // Highest transaction volume
  const sortedByVolume = [...onChainData].sort((a, b) => b.transactionVolume - a.transactionVolume);
  if (sortedByVolume.length > 0) {
    insights.push({
      type: 'highest_transaction_volume',
      symbol: sortedByVolume[0].symbol,
      transactionVolume: sortedByVolume[0].transactionVolume,
      velocity: sortedByVolume[0].velocity
    });
  }
  
  // Fastest growing networks
  const sortedByGrowth = [...onChainData].sort((a, b) => b.networkGrowth - a.networkGrowth);
  if (sortedByGrowth.length > 0) {
    insights.push({
      type: 'fastest_growing_network',
      symbol: sortedByGrowth[0].symbol,
      networkGrowth: sortedByGrowth[0].networkGrowth,
      activeAddresses: sortedByGrowth[0].activeAddresses
    });
  }
  
  // High velocity assets (active usage)
  const highVelocity = onChainData
    .filter(d => d.velocity > 0)
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 3);
    
  if (highVelocity.length > 0) {
    insights.push({
      type: 'high_velocity_assets',
      assets: highVelocity.map(d => ({
        symbol: d.symbol,
        velocity: d.velocity,
        transactionVolume: d.transactionVolume
      }))
    });
  }
  
  return insights;
}
