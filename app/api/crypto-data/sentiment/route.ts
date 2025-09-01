import { NextRequest, NextResponse } from 'next/server';
import { sentimentAPIManager } from '@/lib/crypto-apis/sentiment-manager';

/**
 * GET /api/crypto-data/sentiment
 * Fetch cryptocurrency sentiment data from multiple providers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const includeDetails = searchParams.get('includeDetails') === 'true';
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
    
    if (symbols.length === 0 || symbols.length > 20) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid symbols count',
          message: 'Please provide 1-20 symbols for sentiment analysis'
        },
        { status: 400 }
      );
    }

    console.log(`Fetching sentiment for symbols: ${symbols.join(', ')}`);

    // Get sentiment data
    const sentimentData = await sentimentAPIManager.getSentiment(symbols);
    
    // Calculate aggregate sentiment metrics
    const aggregateMetrics = {
      totalSymbols: symbols.length,
      sentimentFound: sentimentData.length,
      overallSentiment: calculateOverallSentiment(sentimentData),
      averageScore: sentimentData.reduce((sum, s) => sum + s.score, 0) / sentimentData.length || 0,
      averageConfidence: sentimentData.reduce((sum, s) => sum + s.confidence, 0) / sentimentData.length || 0,
      totalSocialVolume: sentimentData.reduce((sum, s) => sum + s.socialVolume, 0),
      totalNewsVolume: sentimentData.reduce((sum, s) => sum + s.newsVolume, 0),
      sentimentDistribution: {
        bullish: sentimentData.filter(s => s.sentiment === 'bullish').length,
        bearish: sentimentData.filter(s => s.sentiment === 'bearish').length,
        neutral: sentimentData.filter(s => s.sentiment === 'neutral').length
      }
    };

    const response: any = {
      success: true,
      data: {
        sentiment: sentimentData,
        aggregateMetrics,
        timestamp: new Date().toISOString()
      }
    };

    // Include provider health if requested
    if (includeHealth) {
      response.data.providerHealth = await sentimentAPIManager.checkProvidersHealth();
    }

    // Filter out details if not requested
    if (!includeDetails) {
      response.data.sentiment = sentimentData.map(s => ({
        symbol: s.symbol,
        sentiment: s.sentiment,
        score: s.score,
        confidence: s.confidence,
        lastUpdated: s.lastUpdated
      }));
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching sentiment data:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sentiment data',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crypto-data/sentiment
 * Advanced sentiment analysis with filtering and aggregation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      symbols, 
      timeframe = '24h',
      minConfidence = 0,
      sentimentFilter,
      aggregateBy = 'symbol'
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
    
    if (normalizedSymbols.length === 0 || normalizedSymbols.length > 50) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid symbols count',
          message: 'Please provide 1-50 symbols'
        },
        { status: 400 }
      );
    }

    console.log(`POST: Fetching sentiment for ${normalizedSymbols.length} symbols`);

    // Get sentiment data
    let sentimentData = await sentimentAPIManager.getSentiment(normalizedSymbols);
    
    // Apply filters
    if (minConfidence > 0) {
      sentimentData = sentimentData.filter(s => s.confidence >= minConfidence);
    }
    
    if (sentimentFilter) {
      sentimentData = sentimentData.filter(s => s.sentiment === sentimentFilter);
    }

    // Aggregate data based on request
    let aggregatedData;
    if (aggregateBy === 'sentiment') {
      aggregatedData = aggregateBySentiment(sentimentData);
    } else if (aggregateBy === 'source') {
      aggregatedData = aggregateBySource(sentimentData);
    } else {
      aggregatedData = sentimentData;
    }

    // Generate insights
    const insights = generateSentimentInsights(sentimentData);

    return NextResponse.json({
      success: true,
      data: {
        sentiment: aggregatedData,
        insights,
        filters: {
          timeframe,
          minConfidence,
          sentimentFilter,
          aggregateBy
        },
        metadata: {
          totalSymbols: normalizedSymbols.length,
          filteredResults: sentimentData.length,
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error in POST sentiment analysis:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform sentiment analysis',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateOverallSentiment(sentimentData: any[]): string {
  if (sentimentData.length === 0) return 'neutral';
  
  const averageScore = sentimentData.reduce((sum, s) => sum + s.score, 0) / sentimentData.length;
  
  if (averageScore > 0.2) return 'bullish';
  if (averageScore < -0.2) return 'bearish';
  return 'neutral';
}

function aggregateBySentiment(sentimentData: any[]) {
  const groups = {
    bullish: sentimentData.filter(s => s.sentiment === 'bullish'),
    bearish: sentimentData.filter(s => s.sentiment === 'bearish'),
    neutral: sentimentData.filter(s => s.sentiment === 'neutral')
  };

  return Object.entries(groups).map(([sentiment, data]) => ({
    sentiment,
    count: data.length,
    averageScore: data.reduce((sum, s) => sum + s.score, 0) / data.length || 0,
    averageConfidence: data.reduce((sum, s) => sum + s.confidence, 0) / data.length || 0,
    symbols: data.map(s => s.symbol),
    totalSocialVolume: data.reduce((sum, s) => sum + s.socialVolume, 0),
    totalNewsVolume: data.reduce((sum, s) => sum + s.newsVolume, 0)
  }));
}

function aggregateBySource(sentimentData: any[]) {
  const sourceMap = new Map();
  
  sentimentData.forEach(item => {
    item.sources.forEach((source: string) => {
      if (!sourceMap.has(source)) {
        sourceMap.set(source, {
          source,
          count: 0,
          symbols: new Set(),
          totalScore: 0,
          totalConfidence: 0,
          sentiments: { bullish: 0, bearish: 0, neutral: 0 }
        });
      }
      
      const sourceData = sourceMap.get(source);
      sourceData.count++;
      sourceData.symbols.add(item.symbol);
      sourceData.totalScore += item.score;
      sourceData.totalConfidence += item.confidence;
      sourceData.sentiments[item.sentiment]++;
    });
  });

  return Array.from(sourceMap.values()).map(source => ({
    ...source,
    symbols: Array.from(source.symbols),
    averageScore: source.totalScore / source.count,
    averageConfidence: source.totalConfidence / source.count
  }));
}

function generateSentimentInsights(sentimentData: any[]) {
  const insights = [];
  
  // Most bullish/bearish assets
  const sortedByScore = [...sentimentData].sort((a, b) => b.score - a.score);
  if (sortedByScore.length > 0) {
    insights.push({
      type: 'most_bullish',
      symbol: sortedByScore[0].symbol,
      score: sortedByScore[0].score,
      confidence: sortedByScore[0].confidence
    });
    
    insights.push({
      type: 'most_bearish',
      symbol: sortedByScore[sortedByScore.length - 1].symbol,
      score: sortedByScore[sortedByScore.length - 1].score,
      confidence: sortedByScore[sortedByScore.length - 1].confidence
    });
  }
  
  // High social volume assets
  const highSocialVolume = sentimentData
    .filter(s => s.socialVolume > 0)
    .sort((a, b) => b.socialVolume - a.socialVolume)
    .slice(0, 3);
    
  if (highSocialVolume.length > 0) {
    insights.push({
      type: 'high_social_activity',
      assets: highSocialVolume.map(s => ({
        symbol: s.symbol,
        socialVolume: s.socialVolume,
        sentiment: s.sentiment
      }))
    });
  }
  
  return insights;
}
