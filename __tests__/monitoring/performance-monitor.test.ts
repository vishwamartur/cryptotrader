// Performance Monitor Tests
// Comprehensive testing for API performance monitoring system

import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor'

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  describe('Metric Recording', () => {
    it('should record API performance metrics', () => {
      const metric = {
        endpoint: '/api/trading/order',
        method: 'POST',
        responseTime: 150,
        statusCode: 200,
        requestSize: 1024,
        responseSize: 512
      }

      monitor.recordMetric(metric)
      const summary = monitor.getPerformanceSummary(60000)
      
      expect(summary.avgResponseTime).toBe(150)
      expect(summary.errorRate).toBe(0)
      expect(summary.throughput).toBeGreaterThan(0)
    })

    it('should record trading performance metrics', () => {
      const tradingMetric = {
        operation: 'ORDER_PLACEMENT' as const,
        symbol: 'BTC-USD',
        latency: 200,
        success: true,
        impactOnProfitability: 0.01
      }

      monitor.recordTradingMetric(tradingMetric)
      const impact = monitor.getTradingPerformanceImpact(60000)
      
      expect(impact.avgTradingLatency).toBe(200)
      expect(impact.tradingSuccessRate).toBe(1)
      expect(impact.profitabilityImpact).toBe(0.01)
    })

    it('should track missed trading opportunities', () => {
      const tradingMetric = {
        operation: 'ORDER_PLACEMENT' as const,
        symbol: 'BTC-USD',
        latency: 600, // High latency
        success: false,
        tradingOpportunityMissed: true
      }

      monitor.recordTradingMetric(tradingMetric)
      const impact = monitor.getTradingPerformanceImpact(60000)
      
      expect(impact.missedOpportunities).toBe(1)
      expect(impact.tradingSuccessRate).toBe(0)
    })
  })

  describe('Alert Generation', () => {
    it('should generate latency alerts for critical response times', () => {
      const metric = {
        endpoint: '/api/trading/order',
        method: 'POST',
        responseTime: 600, // Critical latency
        statusCode: 200,
        requestSize: 1024,
        responseSize: 512
      }

      monitor.recordMetric(metric)
      const alerts = monitor.getActiveAlerts()
      
      expect(alerts).toHaveLength(1)
      expect(alerts[0].type).toBe('LATENCY')
      expect(alerts[0].severity).toBe('CRITICAL')
    })

    it('should generate error rate alerts for server errors', () => {
      const metric = {
        endpoint: '/api/trading/order',
        method: 'POST',
        responseTime: 150,
        statusCode: 500, // Server error
        requestSize: 1024,
        responseSize: 512
      }

      monitor.recordMetric(metric)
      const alerts = monitor.getActiveAlerts()
      
      expect(alerts).toHaveLength(1)
      expect(alerts[0].type).toBe('ERROR_RATE')
      expect(alerts[0].severity).toBe('HIGH')
    })

    it('should generate trading opportunity alerts', () => {
      const tradingMetric = {
        operation: 'ORDER_PLACEMENT' as const,
        symbol: 'BTC-USD',
        latency: 600,
        success: false,
        tradingOpportunityMissed: true
      }

      monitor.recordTradingMetric(tradingMetric)
      const alerts = monitor.getActiveAlerts()
      
      expect(alerts.some(alert => alert.type === 'THROUGHPUT')).toBe(true)
    })
  })

  describe('API Health Status', () => {
    it('should track API endpoint health', () => {
      // Record multiple metrics for the same endpoint
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          endpoint: '/api/trading/order',
          method: 'POST',
          responseTime: 100 + i * 10,
          statusCode: 200,
          requestSize: 1024,
          responseSize: 512
        })
      }

      const healthStatus = monitor.getAPIHealthStatus()
      const orderEndpoint = healthStatus.find(h => h.endpoint.includes('/api/trading/order'))
      
      expect(orderEndpoint).toBeDefined()
      expect(orderEndpoint?.status).toBe('HEALTHY')
      expect(orderEndpoint?.avgResponseTime).toBeGreaterThan(0)
    })

    it('should mark endpoints as degraded for high latency', () => {
      // Record metrics with high latency
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          endpoint: '/api/trading/order',
          method: 'POST',
          responseTime: 300, // High latency
          statusCode: 200,
          requestSize: 1024,
          responseSize: 512
        })
      }

      const healthStatus = monitor.getAPIHealthStatus()
      const orderEndpoint = healthStatus.find(h => h.endpoint.includes('/api/trading/order'))
      
      expect(orderEndpoint?.status).toBe('DEGRADED')
    })

    it('should mark endpoints as critical for very high latency', () => {
      // Record metrics with critical latency
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          endpoint: '/api/trading/order',
          method: 'POST',
          responseTime: 600, // Critical latency
          statusCode: 200,
          requestSize: 1024,
          responseSize: 512
        })
      }

      const healthStatus = monitor.getAPIHealthStatus()
      const orderEndpoint = healthStatus.find(h => h.endpoint.includes('/api/trading/order'))
      
      expect(orderEndpoint?.status).toBe('CRITICAL')
    })
  })

  describe('External API Monitoring', () => {
    it('should track external API metrics', () => {
      monitor.updateExternalAPIMetrics('COINBASE', {
        endpoint: '/products',
        rateLimitUsage: 0.5,
        rateLimitRemaining: 500,
        connectionStatus: 'CONNECTED',
        lastLatency: 200,
        errorCount: 0
      })

      const externalAPIs = monitor.getExternalAPIMetrics()
      const coinbaseAPI = externalAPIs.find(api => api.provider === 'COINBASE')
      
      expect(coinbaseAPI).toBeDefined()
      expect(coinbaseAPI?.connectionStatus).toBe('CONNECTED')
      expect(coinbaseAPI?.rateLimitUsage).toBe(0.5)
    })

    it('should generate alerts for high rate limit usage', () => {
      monitor.updateExternalAPIMetrics('COINBASE', {
        endpoint: '/products',
        rateLimitUsage: 0.95, // High usage
        rateLimitRemaining: 50,
        connectionStatus: 'CONNECTED',
        lastLatency: 200,
        errorCount: 0
      })

      const alerts = monitor.getActiveAlerts()
      
      expect(alerts.some(alert => alert.type === 'EXTERNAL_API')).toBe(true)
    })

    it('should generate alerts for disconnected APIs', () => {
      monitor.updateExternalAPIMetrics('COINBASE', {
        endpoint: '/products',
        rateLimitUsage: 0.5,
        rateLimitRemaining: 500,
        connectionStatus: 'DISCONNECTED',
        lastLatency: 200,
        errorCount: 1
      })

      const alerts = monitor.getActiveAlerts()
      
      expect(alerts.some(alert => 
        alert.type === 'EXTERNAL_API' && alert.severity === 'CRITICAL'
      )).toBe(true)
    })
  })

  describe('WebSocket Monitoring', () => {
    it('should track WebSocket metrics', () => {
      monitor.updateWebSocketMetrics('ws-btc-usd', {
        symbol: 'BTC-USD',
        status: 'CONNECTED',
        messagesReceived: 100,
        messagesPerSecond: 10,
        reconnectCount: 0,
        avgLatency: 50
      })

      const wsMetrics = monitor.getWebSocketMetrics()
      const btcWS = wsMetrics.find(ws => ws.connectionId === 'ws-btc-usd')
      
      expect(btcWS).toBeDefined()
      expect(btcWS?.status).toBe('CONNECTED')
      expect(btcWS?.symbol).toBe('BTC-USD')
    })

    it('should generate alerts for WebSocket disconnections', () => {
      monitor.updateWebSocketMetrics('ws-btc-usd', {
        symbol: 'BTC-USD',
        status: 'DISCONNECTED',
        messagesReceived: 100,
        messagesPerSecond: 0,
        reconnectCount: 1,
        avgLatency: 0
      })

      const alerts = monitor.getActiveAlerts()
      
      expect(alerts.some(alert => alert.type === 'WEBSOCKET')).toBe(true)
    })

    it('should generate alerts for frequent reconnections', () => {
      monitor.updateWebSocketMetrics('ws-btc-usd', {
        symbol: 'BTC-USD',
        status: 'CONNECTED',
        messagesReceived: 100,
        messagesPerSecond: 10,
        reconnectCount: 6, // Frequent reconnections
        avgLatency: 50
      })

      const alerts = monitor.getActiveAlerts()
      
      expect(alerts.some(alert => 
        alert.type === 'WEBSOCKET' && alert.severity === 'MEDIUM'
      )).toBe(true)
    })
  })

  describe('Performance Trends', () => {
    it('should calculate performance trends over time', () => {
      const now = Date.now()
      
      // Record metrics over time
      for (let i = 0; i < 20; i++) {
        monitor.recordMetric({
          endpoint: '/api/trading/order',
          method: 'POST',
          responseTime: 100 + i * 5,
          statusCode: 200,
          requestSize: 1024,
          responseSize: 512
        })
      }

      const trends = monitor.getPerformanceTrends(3600000) // 1 hour
      
      expect(trends.responseTimeTrend).toBeDefined()
      expect(trends.errorRateTrend).toBeDefined()
      expect(trends.throughputTrend).toBeDefined()
      expect(trends.responseTimeTrend.length).toBeGreaterThan(0)
    })
  })

  describe('Alert Management', () => {
    it('should acknowledge alerts', () => {
      const metric = {
        endpoint: '/api/trading/order',
        method: 'POST',
        responseTime: 600, // Critical latency
        statusCode: 200,
        requestSize: 1024,
        responseSize: 512
      }

      monitor.recordMetric(metric)
      let alerts = monitor.getActiveAlerts()
      expect(alerts).toHaveLength(1)

      monitor.acknowledgeAlert(alerts[0].id)
      alerts = monitor.getActiveAlerts()
      expect(alerts).toHaveLength(0)
    })
  })

  describe('Performance Summary', () => {
    it('should provide comprehensive performance summary', () => {
      // Record various metrics
      monitor.recordMetric({
        endpoint: '/api/trading/order',
        method: 'POST',
        responseTime: 150,
        statusCode: 200,
        requestSize: 1024,
        responseSize: 512
      })

      monitor.recordMetric({
        endpoint: '/api/market/data',
        method: 'GET',
        responseTime: 80,
        statusCode: 200,
        requestSize: 512,
        responseSize: 2048
      })

      monitor.recordMetric({
        endpoint: '/api/portfolio/balance',
        method: 'GET',
        responseTime: 120,
        statusCode: 500, // Error
        requestSize: 256,
        responseSize: 128
      })

      const summary = monitor.getPerformanceSummary(60000)
      
      expect(summary.avgResponseTime).toBeGreaterThan(0)
      expect(summary.errorRate).toBeGreaterThan(0)
      expect(summary.throughput).toBeGreaterThan(0)
      expect(summary.healthyEndpoints + summary.degradedEndpoints + summary.criticalEndpoints).toBeGreaterThan(0)
    })
  })

  describe('Trading Performance Impact', () => {
    it('should calculate trading performance impact', () => {
      monitor.recordTradingMetric({
        operation: 'ORDER_PLACEMENT',
        symbol: 'BTC-USD',
        latency: 200,
        success: true,
        impactOnProfitability: 0.01
      })

      monitor.recordTradingMetric({
        operation: 'MARKET_DATA',
        symbol: 'ETH-USD',
        latency: 100,
        success: true,
        impactOnProfitability: 0.005
      })

      monitor.recordTradingMetric({
        operation: 'ORDER_PLACEMENT',
        symbol: 'BTC-USD',
        latency: 600,
        success: false,
        tradingOpportunityMissed: true,
        impactOnProfitability: -0.02
      })

      const impact = monitor.getTradingPerformanceImpact(60000)
      
      expect(impact.missedOpportunities).toBe(1)
      expect(impact.avgTradingLatency).toBeGreaterThan(0)
      expect(impact.tradingSuccessRate).toBeLessThan(1)
      expect(impact.profitabilityImpact).toBeLessThan(0.02)
    })
  })
})
