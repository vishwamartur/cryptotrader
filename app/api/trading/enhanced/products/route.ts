/**
 * Enhanced Products API Route with Trading Best Practices
 * Demonstrates integration of error handling, monitoring, rate limiting, and logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEnhancedDeltaAPI } from '@/lib/trading/enhanced-delta-api';
import { getLogger } from '@/lib/trading/logger';
import { getMonitoring } from '@/lib/trading/monitoring';
import { generateCorrelationId, TradingError, ValidationError } from '@/lib/trading/errors';

const logger = getLogger();
const monitoring = getMonitoring();

// Cache for products data
let productsCache: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();
  
  // Start performance timer
  const endTimer = logger.startTimer('get_products', { correlationId });

  try {
    logger.info('Products API request initiated', {
      correlationId,
      url: request.url,
      userAgent: request.headers.get('user-agent')
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '100');
    const forceRefresh = searchParams.get('force_refresh') === 'true';

    // Validate parameters
    if (page < 1 || page > 1000) {
      throw new ValidationError('Page must be between 1 and 1000', {
        correlationId,
        parameter: 'page',
        value: page
      });
    }

    if (pageSize < 1 || pageSize > 500) {
      throw new ValidationError('Page size must be between 1 and 500', {
        correlationId,
        parameter: 'page_size',
        value: pageSize
      });
    }

    // Check cache first (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && productsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      logger.info('Returning cached products data', {
        correlationId,
        cacheAge: now - cacheTimestamp,
        page,
        pageSize
      });

      endTimer();

      // Record cache hit metric
      monitoring.recordMetric('api_cache_hits', 'COUNTER' as any, 1, {
        endpoint: '/api/trading/enhanced/products'
      });

      return NextResponse.json({
        success: true,
        data: productsCache,
        cached: true,
        cacheAge: now - cacheTimestamp,
        timestamp: now,
        correlationId
      });
    }

    // Create enhanced Delta API client
    const deltaAPI = createEnhancedDeltaAPI({
      enableRiskManagement: false, // Not needed for market data
      enableMonitoring: true,
      enablePaperTrading: false
    });

    try {
      logger.debug('Fetching products from Delta Exchange', {
        correlationId,
        page,
        pageSize
      });

      // Fetch products with enhanced error handling and rate limiting
      const productsResponse = await deltaAPI.getProducts(page, pageSize);

      if (!productsResponse.success || !productsResponse.result) {
        throw new TradingError(
          'Failed to fetch products from Delta Exchange',
          'API_ERROR' as any,
          'HIGH' as any,
          { correlationId, response: productsResponse }
        );
      }

      const products = productsResponse.result;

      // Transform and enrich product data
      const enrichedProducts = products.map(product => ({
        id: product.id,
        symbol: product.symbol,
        description: product.description,
        contractType: product.contract_type,
        state: product.state,
        tradingStatus: product.trading_status,
        tickSize: product.tick_size,
        contractValue: product.contract_value,
        initialMargin: product.initial_margin,
        maintenanceMargin: product.maintenance_margin,
        takerCommission: product.taker_commission_rate,
        makerCommission: product.maker_commission_rate,
        maxLeverage: product.default_leverage,
        underlyingAsset: product.underlying_asset,
        quotingAsset: product.quoting_asset,
        settlingAsset: product.settling_asset,
        isQuanto: product.is_quanto,
        fundingMethod: product.funding_method,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      }));

      // Update cache
      productsCache = {
        products: enrichedProducts,
        totalCount: enrichedProducts.length,
        page,
        pageSize,
        fetchedAt: now
      };
      cacheTimestamp = now;

      logger.info('Products fetched successfully', {
        correlationId,
        productCount: enrichedProducts.length,
        page,
        pageSize,
        duration: Date.now() - startTime
      });

      // Record success metrics
      monitoring.recordMetric('api_requests', 'COUNTER' as any, 1, {
        endpoint: '/api/trading/enhanced/products',
        status: 'success'
      });

      monitoring.recordMetric('products_fetched', 'GAUGE' as any, enrichedProducts.length, {
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      endTimer();

      return NextResponse.json({
        success: true,
        data: productsCache,
        cached: false,
        timestamp: now,
        correlationId,
        metrics: deltaAPI.getMetrics()
      });

    } finally {
      // Clean up API client
      deltaAPI.destroy();
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Products API request failed', {
      correlationId,
      duration,
      error: (error as Error).message,
      stack: (error as Error).stack
    }, error as Error);

    // Record error metrics
    monitoring.recordMetric('api_requests', 'COUNTER' as any, 1, {
      endpoint: '/api/trading/enhanced/products',
      status: 'error'
    });

    monitoring.recordMetric('api_errors', 'COUNTER' as any, 1, {
      endpoint: '/api/trading/enhanced/products',
      errorType: (error as any).type || 'unknown'
    });

    endTimer();

    // Handle different error types
    if (error instanceof ValidationError) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'validation_error',
          message: error.message,
          details: error.context
        },
        correlationId
      }, { status: 400 });
    }

    if (error instanceof TradingError) {
      const statusCode = error.statusCode || 500;
      return NextResponse.json({
        success: false,
        error: {
          type: error.type,
          message: error.message,
          severity: error.severity,
          retryable: error.retryable
        },
        correlationId
      }, { status: statusCode });
    }

    // Generic error response
    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'An unexpected error occurred while fetching products',
        retryable: true
      },
      correlationId
    }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  const correlationId = generateCorrelationId();
  
  try {
    logger.debug('Products API health check', { correlationId });

    // Check if cache is healthy
    const cacheHealthy = productsCache !== null;
    const cacheAge = Date.now() - cacheTimestamp;
    const cacheStale = cacheAge > CACHE_DURATION * 2; // Consider stale if 2x cache duration

    // Check system metrics
    const systemStatus = monitoring.getSystemStatus();
    const hasActiveAlerts = systemStatus.alerts.critical > 0 || systemStatus.alerts.error > 0;

    const healthStatus = {
      healthy: cacheHealthy && !cacheStale && !hasActiveAlerts,
      cache: {
        exists: cacheHealthy,
        age: cacheAge,
        stale: cacheStale
      },
      alerts: systemStatus.alerts,
      timestamp: Date.now(),
      correlationId
    };

    logger.info('Products API health check completed', {
      correlationId,
      healthy: healthStatus.healthy,
      cacheAge,
      activeAlerts: systemStatus.alerts.total
    });

    if (healthStatus.healthy) {
      return new NextResponse(null, { status: 200 });
    } else {
      return new NextResponse(null, { status: 503 }); // Service Unavailable
    }

  } catch (error) {
    logger.error('Products API health check failed', {
      correlationId,
      error: (error as Error).message
    }, error as Error);

    return new NextResponse(null, { status: 503 });
  }
}

// Clear cache endpoint (for admin use)
export async function DELETE(request: NextRequest) {
  const correlationId = generateCorrelationId();
  
  try {
    logger.info('Cache clear requested', { correlationId });

    productsCache = null;
    cacheTimestamp = 0;

    monitoring.recordMetric('cache_clears', 'COUNTER' as any, 1, {
      endpoint: '/api/trading/enhanced/products'
    });

    logger.info('Products cache cleared', { correlationId });

    return NextResponse.json({
      success: true,
      message: 'Products cache cleared successfully',
      timestamp: Date.now(),
      correlationId
    });

  } catch (error) {
    logger.error('Failed to clear products cache', {
      correlationId,
      error: (error as Error).message
    }, error as Error);

    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'Failed to clear cache'
      },
      correlationId
    }, { status: 500 });
  }
}
