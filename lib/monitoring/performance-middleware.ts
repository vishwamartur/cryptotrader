// Performance Monitoring Middleware
// Instruments API routes for comprehensive performance tracking

import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from './performance-monitor'

export interface PerformanceContext {
  startTime: number
  requestSize: number
  dbQueryStartTime?: number
  externalApiStartTime?: number
  cacheChecked?: boolean
  cacheHit?: boolean
}

// Middleware function for API route instrumentation
export function withPerformanceMonitoring<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  options: {
    endpoint?: string
    isCritical?: boolean
    isTradingEndpoint?: boolean
    operation?: 'ORDER_PLACEMENT' | 'MARKET_DATA' | 'PORTFOLIO_UPDATE' | 'SIGNAL_GENERATION'
  } = {}
) {
  return async (...args: T): Promise<NextResponse> => {
    const request = args[0] as NextRequest
    const startTime = performance.now()
    
    // Extract request information
    const endpoint = options.endpoint || request.nextUrl.pathname
    const method = request.method
    const userAgent = request.headers.get('user-agent') || undefined
    const userId = request.headers.get('x-user-id') || undefined
    
    // Calculate request size
    const requestSize = await calculateRequestSize(request)
    
    // Create performance context
    const context: PerformanceContext = {
      startTime,
      requestSize
    }
    
    // Add context to request for use in handlers
    ;(request as any).performanceContext = context

    let response: NextResponse
    let error: Error | null = null
    
    try {
      // Execute the handler
      response = await handler(...args)
    } catch (err) {
      error = err as Error
      // Create error response
      response = NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      )
    }

    // Calculate performance metrics
    const endTime = performance.now()
    const responseTime = endTime - startTime
    const responseSize = calculateResponseSize(response)
    
    // Record performance metric
    performanceMonitor.recordMetric({
      endpoint,
      method,
      responseTime,
      statusCode: response.status,
      requestSize,
      responseSize,
      userAgent,
      userId,
      errorMessage: error?.message,
      dbQueryTime: context.dbQueryStartTime ? endTime - context.dbQueryStartTime : undefined,
      externalApiTime: context.externalApiStartTime ? endTime - context.externalApiStartTime : undefined,
      cacheHit: context.cacheHit
    })

    // Record trading-specific metrics if applicable
    if (options.isTradingEndpoint && options.operation) {
      const success = response.status < 400 && !error
      const tradingOpportunityMissed = responseTime > 500 && options.operation === 'ORDER_PLACEMENT'
      
      performanceMonitor.recordTradingMetric({
        operation: options.operation,
        symbol: extractSymbolFromRequest(request),
        latency: responseTime,
        success,
        errorType: error?.name,
        impactOnProfitability: calculateProfitabilityImpact(responseTime, options.operation),
        tradingOpportunityMissed
      })
    }

    // Add performance headers to response
    response.headers.set('X-Response-Time', `${responseTime.toFixed(2)}ms`)
    response.headers.set('X-Request-Size', `${requestSize}`)
    response.headers.set('X-Response-Size', `${responseSize}`)
    
    if (context.cacheHit !== undefined) {
      response.headers.set('X-Cache', context.cacheHit ? 'HIT' : 'MISS')
    }

    return response
  }
}

// Database query performance tracking
export function trackDatabaseQuery<T>(
  request: NextRequest,
  queryFn: () => Promise<T>
): Promise<T> {
  const context = (request as any).performanceContext as PerformanceContext
  if (context) {
    context.dbQueryStartTime = performance.now()
  }
  
  return queryFn()
}

// External API call performance tracking
export function trackExternalAPICall<T>(
  request: NextRequest,
  provider: string,
  apiFn: () => Promise<T>
): Promise<T> {
  const context = (request as any).performanceContext as PerformanceContext
  if (context) {
    context.externalApiStartTime = performance.now()
  }
  
  const startTime = performance.now()
  
  return apiFn()
    .then(result => {
      const latency = performance.now() - startTime
      
      // Update external API metrics
      performanceMonitor.updateExternalAPIMetrics(provider, {
        lastLatency: latency,
        connectionStatus: 'CONNECTED'
      })
      
      return result
    })
    .catch(error => {
      const latency = performance.now() - startTime
      
      // Update external API metrics with error
      performanceMonitor.updateExternalAPIMetrics(provider, {
        lastLatency: latency,
        connectionStatus: 'DISCONNECTED',
        errorCount: 1
      })
      
      throw error
    })
}

// Cache performance tracking
export function trackCacheOperation<T>(
  request: NextRequest,
  cacheKey: string,
  cacheFn: () => Promise<T | null>,
  fallbackFn: () => Promise<T>
): Promise<T> {
  const context = (request as any).performanceContext as PerformanceContext
  if (context) {
    context.cacheChecked = true
  }
  
  return cacheFn()
    .then(cachedResult => {
      if (cachedResult !== null) {
        if (context) {
          context.cacheHit = true
        }
        return cachedResult
      } else {
        if (context) {
          context.cacheHit = false
        }
        return fallbackFn()
      }
    })
}

// WebSocket performance tracking
export function trackWebSocketMetrics(
  connectionId: string,
  symbol: string,
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR',
  additionalMetrics: Partial<{
    messagesReceived: number
    messagesPerSecond: number
    reconnectCount: number
    avgLatency: number
  }> = {}
): void {
  performanceMonitor.updateWebSocketMetrics(connectionId, {
    symbol,
    status,
    lastMessageTime: Date.now(),
    ...additionalMetrics
  })
}

// Rate limiting tracking
export function trackRateLimit(
  provider: string,
  endpoint: string,
  rateLimitHeaders: {
    used?: number
    remaining?: number
    limit?: number
    resetTime?: number
  }
): void {
  const rateLimitUsage = rateLimitHeaders.used && rateLimitHeaders.limit 
    ? rateLimitHeaders.used / rateLimitHeaders.limit 
    : 0
  
  const rateLimitRemaining = rateLimitHeaders.remaining || 0
  
  performanceMonitor.updateExternalAPIMetrics(provider, {
    endpoint,
    rateLimitUsage,
    rateLimitRemaining
  })
}

// Helper functions
async function calculateRequestSize(request: NextRequest): Promise<number> {
  try {
    const body = await request.clone().text()
    return new Blob([body]).size
  } catch {
    return 0
  }
}

function calculateResponseSize(response: NextResponse): number {
  try {
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      return parseInt(contentLength, 10)
    }
    
    // Estimate size from response body if available
    const body = response.body
    if (body) {
      return new Blob([body]).size
    }
    
    return 0
  } catch {
    return 0
  }
}

function extractSymbolFromRequest(request: NextRequest): string | undefined {
  // Try to extract symbol from URL path
  const pathMatch = request.nextUrl.pathname.match(/\/([A-Z]{3,4}-[A-Z]{3,4})\//i)
  if (pathMatch) {
    return pathMatch[1].toUpperCase()
  }
  
  // Try to extract from query parameters
  const symbol = request.nextUrl.searchParams.get('symbol')
  if (symbol) {
    return symbol.toUpperCase()
  }
  
  return undefined
}

function calculateProfitabilityImpact(
  responseTime: number,
  operation: 'ORDER_PLACEMENT' | 'MARKET_DATA' | 'PORTFOLIO_UPDATE' | 'SIGNAL_GENERATION'
): number {
  // Estimate profitability impact based on latency and operation type
  const baseImpact = responseTime / 1000 // Convert to seconds
  
  switch (operation) {
    case 'ORDER_PLACEMENT':
      // High impact for order placement delays
      return baseImpact * 0.1 // 0.1% impact per second of delay
    case 'MARKET_DATA':
      // Medium impact for market data delays
      return baseImpact * 0.05 // 0.05% impact per second of delay
    case 'SIGNAL_GENERATION':
      // Medium impact for signal generation delays
      return baseImpact * 0.03 // 0.03% impact per second of delay
    case 'PORTFOLIO_UPDATE':
      // Low impact for portfolio update delays
      return baseImpact * 0.01 // 0.01% impact per second of delay
    default:
      return 0
  }
}

// Performance monitoring decorator for class methods
export function MonitorPerformance(
  operation?: 'ORDER_PLACEMENT' | 'MARKET_DATA' | 'PORTFOLIO_UPDATE' | 'SIGNAL_GENERATION'
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now()
      
      try {
        const result = await method.apply(this, args)
        const endTime = performance.now()
        const latency = endTime - startTime
        
        if (operation) {
          performanceMonitor.recordTradingMetric({
            operation,
            latency,
            success: true
          })
        }
        
        return result
      } catch (error) {
        const endTime = performance.now()
        const latency = endTime - startTime
        
        if (operation) {
          performanceMonitor.recordTradingMetric({
            operation,
            latency,
            success: false,
            errorType: (error as Error).name
          })
        }
        
        throw error
      }
    }
    
    return descriptor
  }
}

// Batch performance metrics for high-frequency operations
export class BatchPerformanceTracker {
  private batch: Array<{
    operation: string
    latency: number
    success: boolean
    timestamp: number
  }> = []
  
  private batchSize = 100
  private flushInterval = 5000 // 5 seconds
  
  constructor() {
    setInterval(() => this.flush(), this.flushInterval)
  }
  
  track(operation: string, latency: number, success: boolean): void {
    this.batch.push({
      operation,
      latency,
      success,
      timestamp: Date.now()
    })
    
    if (this.batch.length >= this.batchSize) {
      this.flush()
    }
  }
  
  private flush(): void {
    if (this.batch.length === 0) return
    
    // Calculate batch statistics
    const avgLatency = this.batch.reduce((sum, item) => sum + item.latency, 0) / this.batch.length
    const successRate = this.batch.filter(item => item.success).length / this.batch.length
    
    // Record aggregated metric
    performanceMonitor.recordTradingMetric({
      operation: 'MARKET_DATA', // Default operation for batch
      latency: avgLatency,
      success: successRate > 0.95 // Consider successful if >95% success rate
    })
    
    this.batch = []
  }
}

export const batchTracker = new BatchPerformanceTracker()
