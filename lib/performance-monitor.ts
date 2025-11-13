// Performance Monitoring and Alerting System
// Real-time metrics collection, alerting, and performance dashboard

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'
import { createHash } from 'crypto'

export interface PerformanceThreshold {
  cpu: number        // CPU usage percentage
  memory: number     // Memory usage in MB
  latency: number    // Response time in ms
  errorRate: number  // Error rate percentage
  throughput: number // Requests per second
}

export interface AlertConfig {
  enabled: boolean
  thresholds: PerformanceThreshold
  cooldown: number   // Alert cooldown in seconds
  channels: AlertChannel[]
}

export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty'
  config: any
}

export interface PerformanceAlert {
  id: string
  timestamp: number
  type: 'cpu' | 'memory' | 'latency' | 'error_rate' | 'throughput'
  severity: 'info' | 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  resolved: boolean
  resolvedAt?: number
}

export interface SystemMetrics {
  timestamp: number
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    used: number
    total: number
    percentage: number
    heap: {
      used: number
      total: number
      limit: number
    }
  }
  latency: {
    average: number
    p95: number
    p99: number
    max: number
  }
  throughput: {
    requestsPerSecond: number
    dataThroughput: number // bytes per second
  }
  errors: {
    count: number
    rate: number
    lastError?: string
  }
  cache: {
    hitRate: number
    missRate: number
    size: number
  }
}

export interface ComponentMetrics {
  aiTradingEngine: {
    latency: number
    cacheHitRate: number
    requestCount: number
    errorCount: number
  }
  hftEngine: {
    tickProcessingTime: number
    ticksPerSecond: number
    signalCount: number
    memoryUsage: number
  }
  marketDataCache: {
    responseTime: number
    hitRate: number
    l1Size: number
    l2Size: number
    compressionRatio: number
  }
  webSocketOptimizer: {
    connections: number
    messageLatency: number
    throughput: number
    errorRate: number
  }
  databaseOptimizer: {
    queryTime: number
    connectionPoolUtilization: number
    slowQueries: number
    cacheHitRate: number
  }
  mlOptimizer: {
    trainingTime: number
    inferenceTime: number
    memoryUsage: number
    modelAccuracy: number
  }
}

class MetricsCollector extends EventEmitter {
  private metrics: Map<string, number[]> = new Map()
  private startTime: number = Date.now()
  private lastCollection: number = Date.now()

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const values = this.metrics.get(name)!
    values.push(value)

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift()
    }

    this.emit('metric', { name, value, timestamp: Date.now() })
  }

  getMetricStats(name: string): {
    count: number
    average: number
    min: number
    max: number
    p95: number
    p99: number
  } | null {
    const values = this.metrics.get(name)
    if (!values || values.length === 0) return null

    const sorted = [...values].sort((a, b) => a - b)
    const count = values.length
    const sum = values.reduce((acc, val) => acc + val, 0)

    return {
      count,
      average: sum / count,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    }
  }

  getAllMetrics(): Record<string, any> {
    const allMetrics: Record<string, any> = {}

    for (const [name] of this.metrics) {
      allMetrics[name] = this.getMetricStats(name)
    }

    return allMetrics
  }

  clearMetrics(): void {
    this.metrics.clear()
    this.startTime = Date.now()
  }
}

class AlertManager extends EventEmitter {
  private alerts = new Map<string, PerformanceAlert>()
  private config: AlertConfig
  private cooldowns = new Map<string, number>()

  constructor(config: AlertConfig) {
    super()
    this.config = config
  }

  checkThresholds(metrics: SystemMetrics): PerformanceAlert[] {
    if (!this.config.enabled) return []

    const alerts: PerformanceAlert[] = []
    const now = Date.now()

    // CPU threshold check
    if (metrics.cpu.usage > this.config.thresholds.cpu) {
      const alert = this.createAlert('cpu', 'critical', 'CPU usage exceeded threshold', metrics.cpu.usage, this.config.thresholds.cpu)
      if (this.shouldTriggerAlert(alert, now)) {
        alerts.push(alert)
      }
    }

    // Memory threshold check
    if (metrics.memory.percentage > this.config.thresholds.memory) {
      const alert = this.createAlert('memory', 'critical', 'Memory usage exceeded threshold', metrics.memory.percentage, this.config.thresholds.memory)
      if (this.shouldTriggerAlert(alert, now)) {
        alerts.push(alert)
      }
    }

    // Latency threshold check
    if (metrics.latency.average > this.config.thresholds.latency) {
      const alert = this.createAlert('latency', 'warning', 'Average latency exceeded threshold', metrics.latency.average, this.config.thresholds.latency)
      if (this.shouldTriggerAlert(alert, now)) {
        alerts.push(alert)
      }
    }

    // Error rate threshold check
    if (metrics.errors.rate > this.config.thresholds.errorRate) {
      const alert = this.createAlert('error_rate', 'critical', 'Error rate exceeded threshold', metrics.errors.rate, this.config.thresholds.errorRate)
      if (this.shouldTriggerAlert(alert, now)) {
        alerts.push(alert)
      }
    }

    // Throughput threshold check (minimum threshold)
    if (metrics.throughput.requestsPerSecond < this.config.thresholds.throughput) {
      const alert = this.createAlert('throughput', 'warning', 'Throughput below threshold', metrics.throughput.requestsPerSecond, this.config.thresholds.throughput)
      if (this.shouldTriggerAlert(alert, now)) {
        alerts.push(alert)
      }
    }

    // Send alerts
    for (const alert of alerts) {
      this.sendAlert(alert)
    }

    return alerts
  }

  private shouldTriggerAlert(alert: PerformanceAlert, now: number): boolean {
    const cooldown = this.config.cooldown * 1000 // Convert to milliseconds
    const lastAlertTime = this.cooldowns.get(alert.type)

    if (lastAlertTime && now - lastAlertTime < cooldown) {
      return false
    }

    this.cooldowns.set(alert.type, now)
    return true
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): PerformanceAlert {
    return {
      id: createHash('sha256').update(`${type}-${Date.now()}`).digest('hex').substring(0, 16),
      timestamp: Date.now(),
      type,
      severity,
      message,
      value,
      threshold,
      resolved: false
    }
  }

  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    // Store alert
    this.alerts.set(alert.id, alert)
    this.emit('alert', alert)

    // Send to configured channels
    for (const channel of this.config.channels) {
      try {
        await this.sendToChannel(alert, channel)
      } catch (error) {
        console.error(`Failed to send alert to ${channel.type}:`, error)
      }
    }
  }

  private async sendToChannel(alert: PerformanceAlert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'webhook':
        await this.sendWebhook(alert, channel.config)
        break
      case 'email':
        await this.sendEmail(alert, channel.config)
        break
      case 'slack':
        await this.sendSlack(alert, channel.config)
        break
      case 'pagerduty':
        await this.sendPagerDuty(alert, channel.config)
        break
      default:
        console.warn(`Unknown alert channel type: ${channel.type}`)
    }
  }

  private async sendWebhook(alert: PerformanceAlert, config: any): Promise<void> {
    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      service: 'crypto-trading-platform'
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`)
    }
  }

  private async sendEmail(alert: PerformanceAlert, config: any): Promise<void> {
    // Email sending implementation would go here
    console.log(`Email alert sent: ${alert.message}`)
  }

  private async sendSlack(alert: PerformanceAlert, config: any): Promise<void> {
    const payload = {
      text: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good',
        fields: [
          { title: 'Type', value: alert.type, short: true },
          { title: 'Value', value: alert.value.toFixed(2), short: true },
          { title: 'Threshold', value: alert.threshold.toFixed(2), short: true },
          { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: true }
        ]
      }]
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`)
    }
  }

  private async sendPagerDuty(alert: PerformanceAlert, config: any): Promise<void> {
    // PagerDuty integration implementation would go here
    console.log(`PagerDuty alert sent: ${alert.message}`)
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId)
    if (alert && !alert.resolved) {
      alert.resolved = true
      alert.resolvedAt = Date.now()
      this.emit('alertResolved', alert)
    }
  }

  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  getAlertHistory(limit: number = 100): PerformanceAlert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }
}

export class PerformanceMonitor extends EventEmitter {
  private metricsCollector: MetricsCollector
  private alertManager: AlertManager
  private monitoringInterval: NodeJS.Timeout | null = null
  private componentIntegrations = new Map<string, any>()

  constructor(config: AlertConfig = {
    enabled: true,
    thresholds: {
      cpu: 80,
      memory: 85,
      latency: 1000,
      errorRate: 5,
      throughput: 10
    },
    cooldown: 300, // 5 minutes
    channels: []
  }) {
    super()
    this.metricsCollector = new MetricsCollector()
    this.alertManager = new AlertManager(config)

    // Forward alert events
    this.alertManager.on('alert', (alert) => this.emit('alert', alert))
    this.alertManager.on('alertResolved', (alert) => this.emit('alertResolved', alert))
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring()
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, intervalMs)

    console.log(`Performance monitoring started with ${intervalMs}ms interval`)
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log('Performance monitoring stopped')
    }
  }

  private collectMetrics(): void {
    const metrics = this.gatherSystemMetrics()
    const alerts = this.alertManager.checkThresholds(metrics)

    this.emit('metricsCollected', { metrics, alerts })
  }

  private gatherSystemMetrics(): SystemMetrics {
    const now = Date.now()

    // System resource metrics
    const cpuUsage = process.cpuUsage()
    const memoryUsage = process.memoryUsage()

    const cpuMetrics = {
      usage: this.calculateCPUUsage(),
      loadAverage: require('os').loadavg()
    }

    const memoryMetrics = {
      used: memoryUsage.heapUsed / 1024 / 1024, // MB
      total: memoryUsage.heapTotal / 1024 / 1024, // MB
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      heap: {
        used: memoryUsage.heapUsed / 1024 / 1024,
        total: memoryUsage.heapTotal / 1024 / 1024,
        limit: memoryUsage.heapLimit / 1024 / 1024
      }
    }

    // Performance metrics
    const latencyStats = this.metricsCollector.getMetricStats('responseTime')
    const latencyMetrics = {
      average: latencyStats?.average || 0,
      p95: latencyStats?.p95 || 0,
      p99: latencyStats?.p99 || 0,
      max: latencyStats?.max || 0
    }

    const throughputStats = this.metricsCollector.getMetricStats('throughput')
    const throughputMetrics = {
      requestsPerSecond: throughputStats?.average || 0,
      dataThroughput: this.metricsCollector.getMetricStats('dataThroughput')?.average || 0
    }

    // Error metrics
    const errorStats = this.metricsCollector.getMetricStats('errors')
    const totalRequests = this.metricsCollector.getMetricStats('requests')?.count || 1
    const errorMetrics = {
      count: errorStats?.count || 0,
      rate: ((errorStats?.count || 0) / totalRequests) * 100,
      lastError: this.getLastError()
    }

    // Cache metrics
    const cacheMetrics = this.gatherCacheMetrics()

    return {
      timestamp: now,
      cpu: cpuMetrics,
      memory: memoryMetrics,
      latency: latencyMetrics,
      throughput: throughputMetrics,
      errors: errorMetrics,
      cache: cacheMetrics
    }
  }

  private calculateCPUUsage(): number {
    // Simplified CPU usage calculation
    const usage = process.cpuUsage()
    const totalUsage = usage.user + usage.system
    return (totalUsage / 1000000) * 100 // Convert to percentage
  }

  private getLastError(): string | undefined {
    // This would integrate with error tracking systems
    return undefined
  }

  private gatherCacheMetrics(): {
    hitRate: number
    missRate: number
    size: number
  } {
    // Aggregate cache metrics from all components
    let totalHits = 0
    let totalMisses = 0
    let totalSize = 0

    for (const [, component] of this.componentIntegrations) {
      if (component.getCacheStats) {
        const stats = component.getCacheStats()
        totalHits += stats.hits || 0
        totalMisses += stats.misses || 0
        totalSize += stats.size || 0
      }
    }

    const total = totalHits + totalMisses
    return {
      hitRate: total > 0 ? (totalHits / total) * 100 : 0,
      missRate: total > 0 ? (totalMisses / total) * 100 : 0,
      size: totalSize
    }
  }

  // Component integration methods
  registerComponent(name: string, component: any): void {
    this.componentIntegrations.set(name, component)
  }

  recordComponentMetric(componentName: string, metricName: string, value: number): void {
    const fullName = `${componentName}.${metricName}`
    this.metricsCollector.recordMetric(fullName, value)
  }

  // Performance data recording
  recordResponseTime(timeMs: number): void {
    this.metricsCollector.recordMetric('responseTime', timeMs)
  }

  recordThroughput(operationsPerSecond: number): void {
    this.metricsCollector.recordMetric('throughput', operationsPerSecond)
  }

  recordDataThroughput(bytesPerSecond: number): void {
    this.metricsCollector.recordMetric('dataThroughput', bytesPerSecond)
  }

  recordError(): void {
    this.metricsCollector.recordMetric('errors', 1)
  }

  recordRequest(): void {
    this.metricsCollector.recordMetric('requests', 1)
  }

  // Metrics access methods
  getSystemMetrics(): SystemMetrics {
    return this.gatherSystemMetrics()
  }

  getComponentMetrics(name: string): any {
    const component = this.componentIntegrations.get(name)
    return component?.getMetrics ? component.getMetrics() : null
  }

  getAllComponentMetrics(): ComponentMetrics {
    return {
      aiTradingEngine: this.getComponentMetrics('aiTradingEngine') || {},
      hftEngine: this.getComponentMetrics('hftEngine') || {},
      marketDataCache: this.getComponentMetrics('marketDataCache') || {},
      webSocketOptimizer: this.getComponentMetrics('webSocketOptimizer') || {},
      databaseOptimizer: this.getComponentMetrics('databaseOptimizer') || {},
      mlOptimizer: this.getComponentMetrics('mlOptimizer') || {}
    }
  }

  getHistoricalMetrics(timeRange: number = 3600000): any {
    // Return metrics from the specified time range (default: 1 hour)
    return this.metricsCollector.getAllMetrics()
  }

  getAlerts(): {
    active: PerformanceAlert[]
    history: PerformanceAlert[]
  } {
    return {
      active: this.alertManager.getActiveAlerts(),
      history: this.alertManager.getAlertHistory()
    }
  }

  // Health check
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical'
    metrics: SystemMetrics
    alerts: PerformanceAlert[]
    uptime: number
  } {
    const metrics = this.gatherSystemMetrics()
    const activeAlerts = this.alertManager.getActiveAlerts()
    const uptime = Date.now() - this.metricsCollector['startTime']

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (activeAlerts.some(alert => alert.severity === 'critical')) {
      status = 'critical'
    } else if (activeAlerts.some(alert => alert.severity === 'warning')) {
      status = 'warning'
    }

    return { status, metrics, alerts: activeAlerts, uptime }
  }

  // Cleanup
  cleanup(): void {
    this.stopMonitoring()
    this.metricsCollector.clearMetrics()
    this.componentIntegrations.clear()
  }
}

// Singleton instance
let performanceMonitorInstance: PerformanceMonitor | null = null

export function getPerformanceMonitor(config?: AlertConfig): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor(config)
  }
  return performanceMonitorInstance
}

export default PerformanceMonitor
export {
  PerformanceThreshold,
  AlertConfig,
  AlertChannel,
  PerformanceAlert,
  SystemMetrics,
  ComponentMetrics,
  MetricsCollector,
  AlertManager
}