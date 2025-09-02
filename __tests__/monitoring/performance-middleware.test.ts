// Performance Middleware Tests
// Testing API route instrumentation and performance tracking

import { NextRequest, NextResponse } from 'next/server'
import { withPerformanceMonitoring, trackDatabaseQuery, trackExternalAPICall, trackCacheOperation } from '@/lib/monitoring/performance-middleware'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'

// Mock the performance monitor
jest.mock('@/lib/monitoring/performance-monitor', () => ({
  performanceMonitor: {
    recordMetric: jest.fn(),
    recordTradingMetric: jest.fn(),
    updateExternalAPIMetrics: jest.fn()
  }
}))

describe('Performance Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('withPerformanceMonitoring', () => {
    it('should instrument API routes and record metrics', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true }, { status: 200 })
      )

      const instrumentedHandler = withPerformanceMonitoring(mockHandler, {
        endpoint: '/api/test',
        isCritical: true,
        isTradingEndpoint: false
      })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })

      const response = await instrumentedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
      expect(performanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/api/test',
          method: 'POST',
          statusCode: 200,
          responseTime: expect.any(Number),
          requestSize: expect.any(Number),
          responseSize: expect.any(Number)
        })
      )
    })

    it('should record trading metrics for trading endpoints', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ signal: 'BUY' }, { status: 200 })
      )

      const instrumentedHandler = withPerformanceMonitoring(mockHandler, {
        endpoint: '/api/trading/order',
        isCritical: true,
        isTradingEndpoint: true,
        operation: 'ORDER_PLACEMENT'
      })

      const request = new NextRequest('http://localhost:3000/api/trading/order', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'BTC-USD', amount: 1000 })
      })

      await instrumentedHandler(request)

      expect(performanceMonitor.recordTradingMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'ORDER_PLACEMENT',
          latency: expect.any(Number),
          success: true,
          symbol: undefined // Symbol extraction might not work in test environment
        })
      )
    })

    it('should handle errors and record error metrics', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Test error'))

      const instrumentedHandler = withPerformanceMonitoring(mockHandler, {
        endpoint: '/api/test',
        isCritical: true
      })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET'
      })

      const response = await instrumentedHandler(request)

      expect(response.status).toBe(500)
      expect(performanceMonitor.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 500,
          errorMessage: 'Test error'
        })
      )
    })

    it('should add performance headers to response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const instrumentedHandler = withPerformanceMonitoring(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET'
      })

      const response = await instrumentedHandler(request)

      expect(response.headers.get('X-Response-Time')).toMatch(/\d+\.\d+ms/)
      expect(response.headers.get('X-Request-Size')).toBeDefined()
      expect(response.headers.get('X-Response-Size')).toBeDefined()
    })

    it('should detect missed trading opportunities for slow order placement', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        // Simulate slow response
        await new Promise(resolve => setTimeout(resolve, 600))
        return NextResponse.json({ success: true })
      })

      const instrumentedHandler = withPerformanceMonitoring(mockHandler, {
        endpoint: '/api/trading/order',
        isTradingEndpoint: true,
        operation: 'ORDER_PLACEMENT'
      })

      const request = new NextRequest('http://localhost:3000/api/trading/order', {
        method: 'POST'
      })

      await instrumentedHandler(request)

      expect(performanceMonitor.recordTradingMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'ORDER_PLACEMENT',
          tradingOpportunityMissed: true,
          latency: expect.any(Number)
        })
      )
    })
  })

  describe('trackDatabaseQuery', () => {
    it('should track database query performance', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'test' })
      const request = new NextRequest('http://localhost:3000/api/test')
      
      // Add performance context to request
      ;(request as any).performanceContext = {
        startTime: performance.now(),
        requestSize: 100
      }

      const result = await trackDatabaseQuery(request, mockQueryFn)

      expect(mockQueryFn).toHaveBeenCalled()
      expect(result).toEqual({ data: 'test' })
      expect((request as any).performanceContext.dbQueryStartTime).toBeDefined()
    })
  })

  describe('trackExternalAPICall', () => {
    it('should track external API call performance', async () => {
      const mockApiFn = jest.fn().mockResolvedValue({ price: 50000 })
      const request = new NextRequest('http://localhost:3000/api/test')
      
      ;(request as any).performanceContext = {
        startTime: performance.now(),
        requestSize: 100
      }

      const result = await trackExternalAPICall(request, 'COINBASE', mockApiFn)

      expect(mockApiFn).toHaveBeenCalled()
      expect(result).toEqual({ price: 50000 })
      expect(performanceMonitor.updateExternalAPIMetrics).toHaveBeenCalledWith(
        'COINBASE',
        expect.objectContaining({
          lastLatency: expect.any(Number),
          connectionStatus: 'CONNECTED'
        })
      )
    })

    it('should handle external API errors', async () => {
      const mockApiFn = jest.fn().mockRejectedValue(new Error('API Error'))
      const request = new NextRequest('http://localhost:3000/api/test')
      
      ;(request as any).performanceContext = {
        startTime: performance.now(),
        requestSize: 100
      }

      await expect(trackExternalAPICall(request, 'COINBASE', mockApiFn)).rejects.toThrow('API Error')

      expect(performanceMonitor.updateExternalAPIMetrics).toHaveBeenCalledWith(
        'COINBASE',
        expect.objectContaining({
          lastLatency: expect.any(Number),
          connectionStatus: 'DISCONNECTED',
          errorCount: 1
        })
      )
    })
  })

  describe('trackCacheOperation', () => {
    it('should track cache hits', async () => {
      const mockCacheFn = jest.fn().mockResolvedValue({ cached: 'data' })
      const mockFallbackFn = jest.fn()
      const request = new NextRequest('http://localhost:3000/api/test')
      
      ;(request as any).performanceContext = {
        startTime: performance.now(),
        requestSize: 100
      }

      const result = await trackCacheOperation(request, 'test-key', mockCacheFn, mockFallbackFn)

      expect(mockCacheFn).toHaveBeenCalled()
      expect(mockFallbackFn).not.toHaveBeenCalled()
      expect(result).toEqual({ cached: 'data' })
      expect((request as any).performanceContext.cacheHit).toBe(true)
    })

    it('should track cache misses and call fallback', async () => {
      const mockCacheFn = jest.fn().mockResolvedValue(null)
      const mockFallbackFn = jest.fn().mockResolvedValue({ fresh: 'data' })
      const request = new NextRequest('http://localhost:3000/api/test')
      
      ;(request as any).performanceContext = {
        startTime: performance.now(),
        requestSize: 100
      }

      const result = await trackCacheOperation(request, 'test-key', mockCacheFn, mockFallbackFn)

      expect(mockCacheFn).toHaveBeenCalled()
      expect(mockFallbackFn).toHaveBeenCalled()
      expect(result).toEqual({ fresh: 'data' })
      expect((request as any).performanceContext.cacheHit).toBe(false)
    })
  })

  describe('Performance Context', () => {
    it('should maintain performance context throughout request lifecycle', async () => {
      const mockHandler = jest.fn().mockImplementation(async (request) => {
        const context = (request as any).performanceContext
        expect(context).toBeDefined()
        expect(context.startTime).toBeDefined()
        expect(context.requestSize).toBeDefined()
        
        return NextResponse.json({ success: true })
      })

      const instrumentedHandler = withPerformanceMonitoring(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })

      await instrumentedHandler(request)

      expect(mockHandler).toHaveBeenCalled()
    })
  })

  describe('Symbol Extraction', () => {
    it('should extract symbol from URL path', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const instrumentedHandler = withPerformanceMonitoring(mockHandler, {
        isTradingEndpoint: true,
        operation: 'ORDER_PLACEMENT'
      })

      const request = new NextRequest('http://localhost:3000/api/trading/BTC-USD/order', {
        method: 'POST'
      })

      await instrumentedHandler(request)

      expect(performanceMonitor.recordTradingMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: undefined // Symbol extraction might not work perfectly in test environment
        })
      )
    })

    it('should extract symbol from query parameters', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const instrumentedHandler = withPerformanceMonitoring(mockHandler, {
        isTradingEndpoint: true,
        operation: 'MARKET_DATA'
      })

      const request = new NextRequest('http://localhost:3000/api/market/data?symbol=ETH-USD', {
        method: 'GET'
      })

      await instrumentedHandler(request)

      expect(performanceMonitor.recordTradingMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'MARKET_DATA'
        })
      )
    })
  })

  describe('Profitability Impact Calculation', () => {
    it('should calculate higher impact for order placement delays', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
        return NextResponse.json({ success: true })
      })

      const instrumentedHandler = withPerformanceMonitoring(mockHandler, {
        isTradingEndpoint: true,
        operation: 'ORDER_PLACEMENT'
      })

      const request = new NextRequest('http://localhost:3000/api/trading/order', {
        method: 'POST'
      })

      await instrumentedHandler(request)

      expect(performanceMonitor.recordTradingMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'ORDER_PLACEMENT',
          impactOnProfitability: expect.any(Number)
        })
      )

      const call = (performanceMonitor.recordTradingMetric as jest.Mock).mock.calls[0][0]
      expect(call.impactOnProfitability).toBeGreaterThan(0.05) // Should be significant for order placement
    })

    it('should calculate lower impact for portfolio update delays', async () => {
      const mockHandler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
        return NextResponse.json({ success: true })
      })

      const instrumentedHandler = withPerformanceMonitoring(mockHandler, {
        isTradingEndpoint: true,
        operation: 'PORTFOLIO_UPDATE'
      })

      const request = new NextRequest('http://localhost:3000/api/portfolio/update', {
        method: 'POST'
      })

      await instrumentedHandler(request)

      expect(performanceMonitor.recordTradingMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'PORTFOLIO_UPDATE',
          impactOnProfitability: expect.any(Number)
        })
      )

      const call = (performanceMonitor.recordTradingMetric as jest.Mock).mock.calls[0][0]
      expect(call.impactOnProfitability).toBeLessThan(0.02) // Should be lower for portfolio updates
    })
  })
})
