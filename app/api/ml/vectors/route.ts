import { NextRequest, NextResponse } from 'next/server';
import { pineconeService } from '@/lib/ml/services/pinecone-service';

/**
 * GET /api/ml/vectors
 * Get vector database statistics and health
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('includeStats') === 'true';
    const includeHealth = searchParams.get('includeHealth') === 'true';

    const response: any = {
      success: true,
      data: {
        timestamp: new Date().toISOString()
      }
    };

    if (includeStats) {
      try {
        response.data.indexStats = await pineconeService.getIndexStats();
      } catch (error) {
        response.data.indexStats = null;
        response.data.statsError = error instanceof Error ? error.message : 'Failed to get stats';
      }
    }

    if (includeHealth) {
      response.data.health = await pineconeService.healthCheck();
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in vectors GET:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get vector database info',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ml/vectors
 * Store or query vectors
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing action parameter',
          message: 'Please specify action: "store", "query", "similar_patterns", or "market_regime"'
        },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'store_pattern':
        result = await handleStorePattern(params);
        break;
      
      case 'query_similar':
        result = await handleQuerySimilar(params);
        break;
      
      case 'store_market_regime':
        result = await handleStoreMarketRegime(params);
        break;
      
      case 'find_market_conditions':
        result = await handleFindMarketConditions(params);
        break;
      
      case 'store_technical_indicators':
        result = await handleStoreTechnicalIndicators(params);
        break;

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action',
            message: 'Supported actions: store_pattern, query_similar, store_market_regime, find_market_conditions, store_technical_indicators'
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in vectors POST:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Vector operation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Handler functions
async function handleStorePattern(params: any) {
  const { symbol, patternType, prices, volumes, metadata = {} } = params;

  if (!symbol || !patternType || !prices || !Array.isArray(prices)) {
    throw new Error('Missing required parameters: symbol, patternType, prices');
  }

  if (!['price_pattern', 'sentiment', 'technical_indicator'].includes(patternType)) {
    throw new Error('Invalid patternType. Must be: price_pattern, sentiment, or technical_indicator');
  }

  // Create embedding from price data
  const embedding = pineconeService.constructor.createPricePatternEmbedding(prices, volumes);
  
  const id = await pineconeService.storeTradingPattern(
    symbol,
    patternType,
    embedding,
    {
      priceCount: prices.length,
      volumeCount: volumes?.length || 0,
      ...metadata
    }
  );

  return {
    id,
    symbol,
    patternType,
    embeddingDimensions: embedding.length,
    message: 'Pattern stored successfully'
  };
}

async function handleQuerySimilar(params: any) {
  const { symbol, patternType, prices, volumes, topK = 5 } = params;

  if (!prices || !Array.isArray(prices)) {
    throw new Error('Missing required parameter: prices');
  }

  // Create embedding from price data
  const embedding = pineconeService.constructor.createPricePatternEmbedding(prices, volumes);
  
  const results = await pineconeService.findSimilarPatterns(
    embedding,
    symbol,
    patternType,
    topK
  );

  return {
    query: {
      symbol,
      patternType,
      topK,
      embeddingDimensions: embedding.length
    },
    results: results.map(r => ({
      id: r.id,
      similarity: r.score,
      symbol: r.metadata.symbol,
      type: r.metadata.type,
      timestamp: new Date(r.metadata.timestamp).toISOString(),
      confidence: r.metadata.confidence
    })),
    totalResults: results.length
  };
}

async function handleStoreMarketRegime(params: any) {
  const { regime, features, symbols, confidence = 0.8 } = params;

  if (!regime || !features || !symbols) {
    throw new Error('Missing required parameters: regime, features, symbols');
  }

  if (!['bull', 'bear', 'sideways', 'volatile'].includes(regime)) {
    throw new Error('Invalid regime. Must be: bull, bear, sideways, or volatile');
  }

  if (!Array.isArray(features) || !Array.isArray(symbols)) {
    throw new Error('Features and symbols must be arrays');
  }

  const id = await pineconeService.storeMarketRegime(regime, features, symbols, confidence);

  return {
    id,
    regime,
    symbols,
    featureDimensions: features.length,
    confidence,
    message: 'Market regime stored successfully'
  };
}

async function handleFindMarketConditions(params: any) {
  const { features, topK = 10 } = params;

  if (!features || !Array.isArray(features)) {
    throw new Error('Missing required parameter: features (array)');
  }

  const results = await pineconeService.findSimilarMarketConditions(features, topK);

  return {
    query: {
      featureDimensions: features.length,
      topK
    },
    results: results.map(r => ({
      id: r.id,
      similarity: r.score,
      regime: r.metadata.regime,
      symbols: r.metadata.symbol?.split(',') || [],
      timestamp: new Date(r.metadata.timestamp).toISOString(),
      confidence: r.metadata.confidence
    })),
    totalResults: results.length
  };
}

async function handleStoreTechnicalIndicators(params: any) {
  const { symbol, indicators, timeframe = '1h', metadata = {} } = params;

  if (!symbol || !indicators || typeof indicators !== 'object') {
    throw new Error('Missing required parameters: symbol, indicators');
  }

  // Create embedding from technical indicators
  const embedding = pineconeService.constructor.createTechnicalIndicatorEmbedding(indicators);
  
  const id = await pineconeService.storeTradingPattern(
    symbol,
    'technical_indicator',
    embedding,
    {
      timeframe,
      indicators: Object.keys(indicators),
      indicatorCount: Object.keys(indicators).length,
      ...metadata
    }
  );

  return {
    id,
    symbol,
    timeframe,
    indicators: Object.keys(indicators),
    embeddingDimensions: embedding.length,
    message: 'Technical indicators stored successfully'
  };
}

/**
 * DELETE /api/ml/vectors
 * Delete vectors by IDs
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing or invalid ids parameter',
          message: 'Please provide an array of vector IDs to delete'
        },
        { status: 400 }
      );
    }

    await pineconeService.deleteVectors(ids);

    return NextResponse.json({
      success: true,
      data: {
        deletedIds: ids,
        count: ids.length,
        message: 'Vectors deleted successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in vectors DELETE:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete vectors',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
