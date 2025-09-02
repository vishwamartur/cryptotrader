// Comprehensive API Performance Monitoring System
// Real-time metrics collection and analysis for trading applications

export interface PerformanceMetric {
  id: string
  timestamp: number
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  requestSize: number
  responseSize: number
  userAgent?: string
  userId?: string
  errorMessage?: string
  dbQueryTime?: number
  externalApiTime?: number
  cacheHit?: boolean
}

export interface TradingPerformanceMetric {
  id: string
  timestamp: number
  operation: 'ORDER_PLACEMENT' | 'MARKET_DATA' | 'PORTFOLIO_UPDATE' | 'SIGNAL_GENERATION'
  symbol?: string
  latency: number
  success: boolean
  errorType?: string
  impactOnProfitability?: number
  tradingOpportunityMissed?: boolean
}

export interface APIHealthStatus {
  endpoint: string
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  avgResponseTime: number
  errorRate: number
  throughput: number
  lastChecked: number
}

export interface ExternalAPIMetrics {
  provider: 'COINBASE' | 'BINANCE' | 'KRAKEN' | 'DELTA'
  endpoint: string
  rateLimitUsage: number
  rateLimitRemaining: number
  quotaUsage: number
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'
  lastLatency: number
  errorCount: number
}

export interface WebSocketMetrics {
  connectionId: string
  symbol: string
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  messagesReceived: number
  messagesPerSecond: number
  lastMessageTime: number
  reconnectCount: number
  avgLatency: number
}

export interface PerformanceAlert {
  id: string
  type: 'LATENCY' | 'ERROR_RATE' | 'THROUGHPUT' | 'EXTERNAL_API' | 'WEBSOCKET'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  endpoint?: string
  currentValue: number
  threshold: number
  timestamp: number
  acknowledged: boolean
  resolvedAt?: number
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private tradingMetrics: TradingPerformanceMetric[] = []
  private alerts: PerformanceAlert[] = []
  private apiHealthStatus: Map<string, APIHealthStatus> = new Map()
  private externalApiMetrics: Map<string, ExternalAPIMetrics> = new Map()
  private webSocketMetrics: Map<string, WebSocketMetrics> = new Map()
  
  // Performance thresholds
  private readonly CRITICAL_LATENCY_THRESHOLD = 500 // ms
  private readonly WARNING_LATENCY_THRESHOLD = 200 // ms
  private readonly ERROR_RATE_THRESHOLD = 0.01 // 1%
  private readonly CRITICAL_ERROR_RATE_THRESHOLD = 0.05 // 5%
  
  // Retention settings
  private readonly METRICS_RETENTION_HOURS = 24
  private readonly MAX_METRICS_COUNT = 10000

  constructor() {
    this.startCleanupInterval()
    this.startHealthCheckInterval()
  }

  // Record API performance metric
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...metric
    }

    this.metrics.push(fullMetric)
    this.updateAPIHealthStatus(fullMetric)
    this.checkPerformanceThresholds(fullMetric)
    this.cleanupOldMetrics()
  }

  // Record trading-specific performance metric
  recordTradingMetric(metric: Omit<TradingPerformanceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: TradingPerformanceMetric = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...metric
    }

    this.tradingMetrics.push(fullMetric)
    this.checkTradingPerformanceThresholds(fullMetric)
  }

  // Update external API metrics
  updateExternalAPIMetrics(provider: string, metrics: Partial<ExternalAPIMetrics>): void {
    const existing = this.externalApiMetrics.get(provider)
    const updated: ExternalAPIMetrics = {
      provider: provider as any,
      endpoint: '',
      rateLimitUsage: 0,
      rateLimitRemaining: 1000,
      quotaUsage: 0,
      connectionStatus: 'CONNECTED',
      lastLatency: 0,
      errorCount: 0,
      ...existing,
      ...metrics
    }
    
    this.externalApiMetrics.set(provider, updated)
    this.checkExternalAPIThresholds(updated)
  }

  // Update WebSocket metrics
  updateWebSocketMetrics(connectionId: string, metrics: Partial<WebSocketMetrics>): void {
    const existing = this.webSocketMetrics.get(connectionId)
    const updated: WebSocketMetrics = {
      connectionId,
      symbol: '',
      status: 'CONNECTED',
      messagesReceived: 0,
      messagesPerSecond: 0,
      lastMessageTime: Date.now(),
      reconnectCount: 0,
      avgLatency: 0,
      ...existing,
      ...metrics
    }
    
    this.webSocketMetrics.set(connectionId, updated)
    this.checkWebSocketThresholds(updated)
  }

  // Get real-time performance summary
  getPerformanceSummary(timeWindowMs: number = 300000): {
    avgResponseTime: number
    errorRate: number
    throughput: number
    criticalEndpoints: string[]
    healthyEndpoints: number
    degradedEndpoints: number
    criticalEndpoints: number
  } {
    const cutoffTime = Date.now() - timeWindowMs
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoffTime)
    
    if (recentMetrics.length === 0) {
      return {
        avgResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        criticalEndpoints: [],
        healthyEndpoints: 0,
        degradedEndpoints: 0,
        criticalEndpoints: 0
      }
    }

    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length
    const errorRate = errorCount / recentMetrics.length
    const throughput = recentMetrics.length / (timeWindowMs / 1000)

    // Analyze endpoint health
    const endpointStats = new Map<string, { healthy: number; degraded: number; critical: number }>()
    
    for (const [endpoint, health] of this.apiHealthStatus) {
      const category = health.status === 'HEALTHY' ? 'healthy' : 
                     health.status === 'DEGRADED' ? 'degraded' : 'critical'
      
      const current = endpointStats.get('total') || { healthy: 0, degraded: 0, critical: 0 }
      current[category]++
      endpointStats.set('total', current)
    }

    const stats = endpointStats.get('total') || { healthy: 0, degraded: 0, critical: 0 }
    const criticalEndpoints = Array.from(this.apiHealthStatus.entries())
      .filter(([_, health]) => health.status === 'CRITICAL')
      .map(([endpoint, _]) => endpoint)

    return {
      avgResponseTime,
      errorRate,
      throughput,
      criticalEndpoints,
      healthyEndpoints: stats.healthy,
      degradedEndpoints: stats.degraded,
      criticalEndpoints: stats.critical
    }
  }

  // Get trading performance impact analysis
  getTradingPerformanceImpact(timeWindowMs: number = 300000): {
    missedOpportunities: number
    avgTradingLatency: number
    tradingSuccessRate: number
    profitabilityImpact: number
  } {
    const cutoffTime = Date.now() - timeWindowMs
    const recentTradingMetrics = this.tradingMetrics.filter(m => m.timestamp > cutoffTime)
    
    if (recentTradingMetrics.length === 0) {
      return {
        missedOpportunities: 0,
        avgTradingLatency: 0,
        tradingSuccessRate: 1,
        profitabilityImpact: 0
      }
    }

    const missedOpportunities = recentTradingMetrics.filter(m => m.tradingOpportunityMissed).length
    const avgTradingLatency = recentTradingMetrics.reduce((sum, m) => sum + m.latency, 0) / recentTradingMetrics.length
    const successfulTrades = recentTradingMetrics.filter(m => m.success).length
    const tradingSuccessRate = successfulTrades / recentTradingMetrics.length
    const profitabilityImpact = recentTradingMetrics.reduce((sum, m) => sum + (m.impactOnProfitability || 0), 0)

    return {
      missedOpportunities,
      avgTradingLatency,
      tradingSuccessRate,
      profitabilityImpact
    }
  }

  // Get active alerts
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged && !alert.resolvedAt)
  }

  // Get API health status
  getAPIHealthStatus(): APIHealthStatus[] {
    return Array.from(this.apiHealthStatus.values())
  }

  // Get external API metrics
  getExternalAPIMetrics(): ExternalAPIMetrics[] {
    return Array.from(this.externalApiMetrics.values())
  }

  // Get WebSocket metrics
  getWebSocketMetrics(): WebSocketMetrics[] {
    return Array.from(this.webSocketMetrics.values())
  }

  // Acknowledge alert
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
    }
  }

  // Get performance trends
  getPerformanceTrends(timeWindowMs: number = 3600000): {
    responseTimeTrend: Array<{ timestamp: number; value: number }>
    errorRateTrend: Array<{ timestamp: number; value: number }>
    throughputTrend: Array<{ timestamp: number; value: number }>
  } {
    const cutoffTime = Date.now() - timeWindowMs
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoffTime)
    
    // Group metrics by 5-minute intervals
    const intervalMs = 5 * 60 * 1000 // 5 minutes
    const intervals = new Map<number, PerformanceMetric[]>()
    
    for (const metric of recentMetrics) {
      const intervalStart = Math.floor(metric.timestamp / intervalMs) * intervalMs
      const existing = intervals.get(intervalStart) || []
      existing.push(metric)
      intervals.set(intervalStart, existing)
    }

    const responseTimeTrend: Array<{ timestamp: number; value: number }> = []
    const errorRateTrend: Array<{ timestamp: number; value: number }> = []
    const throughputTrend: Array<{ timestamp: number; value: number }> = []

    for (const [timestamp, metrics] of intervals) {
      const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
      const errorCount = metrics.filter(m => m.statusCode >= 400).length
      const errorRate = errorCount / metrics.length
      const throughput = metrics.length / (intervalMs / 1000)

      responseTimeTrend.push({ timestamp, value: avgResponseTime })
      errorRateTrend.push({ timestamp, value: errorRate })
      throughputTrend.push({ timestamp, value: throughput })
    }

    return {
      responseTimeTrend: responseTimeTrend.sort((a, b) => a.timestamp - b.timestamp),
      errorRateTrend: errorRateTrend.sort((a, b) => a.timestamp - b.timestamp),
      throughputTrend: throughputTrend.sort((a, b) => a.timestamp - b.timestamp)
    }
  }

  // Private helper methods
  private updateAPIHealthStatus(metric: PerformanceMetric): void {
    const key = `${metric.method} ${metric.endpoint}`
    const existing = this.apiHealthStatus.get(key)
    
    // Calculate rolling averages (last 100 requests)
    const recentMetrics = this.metrics
      .filter(m => m.endpoint === metric.endpoint && m.method === metric.method)
      .slice(-100)
    
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length
    const errorRate = errorCount / recentMetrics.length
    const throughput = recentMetrics.length / 60 // requests per minute

    let status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY'
    
    if (avgResponseTime > this.CRITICAL_LATENCY_THRESHOLD || errorRate > this.CRITICAL_ERROR_RATE_THRESHOLD) {
      status = 'CRITICAL'
    } else if (avgResponseTime > this.WARNING_LATENCY_THRESHOLD || errorRate > this.ERROR_RATE_THRESHOLD) {
      status = 'DEGRADED'
    }

    this.apiHealthStatus.set(key, {
      endpoint: key,
      status,
      avgResponseTime,
      errorRate,
      throughput,
      lastChecked: Date.now()
    })
  }

  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    // Check response time threshold
    if (metric.responseTime > this.CRITICAL_LATENCY_THRESHOLD) {
      this.createAlert({
        type: 'LATENCY',
        severity: 'CRITICAL',
        message: `Critical latency detected on ${metric.endpoint}: ${metric.responseTime}ms`,
        endpoint: metric.endpoint,
        currentValue: metric.responseTime,
        threshold: this.CRITICAL_LATENCY_THRESHOLD
      })
    } else if (metric.responseTime > this.WARNING_LATENCY_THRESHOLD) {
      this.createAlert({
        type: 'LATENCY',
        severity: 'MEDIUM',
        message: `High latency detected on ${metric.endpoint}: ${metric.responseTime}ms`,
        endpoint: metric.endpoint,
        currentValue: metric.responseTime,
        threshold: this.WARNING_LATENCY_THRESHOLD
      })
    }

    // Check error status codes
    if (metric.statusCode >= 500) {
      this.createAlert({
        type: 'ERROR_RATE',
        severity: 'HIGH',
        message: `Server error on ${metric.endpoint}: ${metric.statusCode}`,
        endpoint: metric.endpoint,
        currentValue: metric.statusCode,
        threshold: 500
      })
    }
  }

  private checkTradingPerformanceThresholds(metric: TradingPerformanceMetric): void {
    if (metric.tradingOpportunityMissed) {
      this.createAlert({
        type: 'THROUGHPUT',
        severity: 'HIGH',
        message: `Trading opportunity missed due to latency: ${metric.operation}`,
        currentValue: metric.latency,
        threshold: this.CRITICAL_LATENCY_THRESHOLD
      })
    }

    if (!metric.success && metric.operation === 'ORDER_PLACEMENT') {
      this.createAlert({
        type: 'ERROR_RATE',
        severity: 'CRITICAL',
        message: `Order placement failed: ${metric.errorType}`,
        currentValue: 1,
        threshold: 0
      })
    }
  }

  private checkExternalAPIThresholds(metrics: ExternalAPIMetrics): void {
    if (metrics.rateLimitUsage > 0.9) {
      this.createAlert({
        type: 'EXTERNAL_API',
        severity: 'HIGH',
        message: `Rate limit approaching for ${metrics.provider}: ${(metrics.rateLimitUsage * 100).toFixed(1)}%`,
        currentValue: metrics.rateLimitUsage,
        threshold: 0.9
      })
    }

    if (metrics.connectionStatus === 'DISCONNECTED') {
      this.createAlert({
        type: 'EXTERNAL_API',
        severity: 'CRITICAL',
        message: `External API disconnected: ${metrics.provider}`,
        currentValue: 0,
        threshold: 1
      })
    }
  }

  private checkWebSocketThresholds(metrics: WebSocketMetrics): void {
    if (metrics.status === 'DISCONNECTED' || metrics.status === 'ERROR') {
      this.createAlert({
        type: 'WEBSOCKET',
        severity: 'HIGH',
        message: `WebSocket connection issue for ${metrics.symbol}: ${metrics.status}`,
        currentValue: 0,
        threshold: 1
      })
    }

    if (metrics.reconnectCount > 5) {
      this.createAlert({
        type: 'WEBSOCKET',
        severity: 'MEDIUM',
        message: `Frequent WebSocket reconnections for ${metrics.symbol}: ${metrics.reconnectCount}`,
        currentValue: metrics.reconnectCount,
        threshold: 5
      })
    }
  }

  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: PerformanceAlert = {
      id: this.generateId(),
      timestamp: Date.now(),
      acknowledged: false,
      ...alertData
    }

    this.alerts.push(alert)
    
    // Keep only recent alerts
    this.alerts = this.alerts.slice(-1000)
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldMetrics()
      this.cleanupOldAlerts()
    }, 60000) // Every minute
  }

  private startHealthCheckInterval(): void {
    setInterval(() => {
      this.performHealthChecks()
    }, 30000) // Every 30 seconds
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (this.METRICS_RETENTION_HOURS * 60 * 60 * 1000)
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime)
    this.tradingMetrics = this.tradingMetrics.filter(m => m.timestamp > cutoffTime)
    
    // Limit total metrics count
    if (this.metrics.length > this.MAX_METRICS_COUNT) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_COUNT)
    }
    if (this.tradingMetrics.length > this.MAX_METRICS_COUNT) {
      this.tradingMetrics = this.tradingMetrics.slice(-this.MAX_METRICS_COUNT)
    }
  }

  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    this.alerts = this.alerts.filter(a => a.timestamp > cutoffTime)
  }

  private performHealthChecks(): void {
    // Auto-resolve alerts if conditions improve
    for (const alert of this.alerts) {
      if (!alert.acknowledged && !alert.resolvedAt) {
        if (this.shouldResolveAlert(alert)) {
          alert.resolvedAt = Date.now()
        }
      }
    }
  }

  private shouldResolveAlert(alert: PerformanceAlert): boolean {
    if (alert.endpoint) {
      const health = this.apiHealthStatus.get(alert.endpoint)
      if (health && health.status === 'HEALTHY') {
        return true
      }
    }
    return false
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()
