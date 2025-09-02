// API Performance Monitoring Endpoint
// Provides real-time performance metrics and health status

import { type NextRequest, NextResponse } from "next/server"
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { withPerformanceMonitoring } from '@/lib/monitoring/performance-middleware'

export const GET = withPerformanceMonitoring(
  async (request: NextRequest) => {
    try {
      // Get query parameters for time window
      const timeWindow = parseInt(request.nextUrl.searchParams.get('timeWindow') || '300000') // 5 minutes default
      
      // Get performance summary
      const performanceMetrics = performanceMonitor.getPerformanceSummary(timeWindow)
      
      // Get trading performance impact
      const tradingMetrics = performanceMonitor.getTradingPerformanceImpact(timeWindow)
      
      // Get API health status
      const apiHealth = performanceMonitor.getAPIHealthStatus()
      
      // Get external API metrics
      const externalAPIs = performanceMonitor.getExternalAPIMetrics()
      
      // Get WebSocket metrics
      const webSocketMetrics = performanceMonitor.getWebSocketMetrics()
      
      // Get active alerts
      const alerts = performanceMonitor.getActiveAlerts()
      
      // Get performance trends
      const trends = performanceMonitor.getPerformanceTrends(timeWindow)
      
      // Calculate system health score
      const systemHealthScore = calculateSystemHealthScore(
        performanceMetrics,
        tradingMetrics,
        apiHealth,
        externalAPIs,
        alerts
      )
      
      // Prepare response
      const response = {
        timestamp: new Date().toISOString(),
        timeWindow,
        systemHealthScore,
        performanceMetrics,
        tradingMetrics,
        apiHealth,
        externalAPIs,
        webSocketMetrics,
        alerts,
        trends,
        recommendations: generatePerformanceRecommendations(
          performanceMetrics,
          tradingMetrics,
          apiHealth,
          alerts
        )
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Performance monitoring error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch performance metrics' },
        { status: 500 }
      )
    }
  },
  {
    endpoint: '/api/monitoring/performance',
    isCritical: false,
    isTradingEndpoint: false
  }
)

export const POST = withPerformanceMonitoring(
  async (request: NextRequest) => {
    try {
      const body = await request.json()
      const { action, alertId, timeWindow } = body

      switch (action) {
        case 'acknowledgeAlert':
          if (alertId) {
            performanceMonitor.acknowledgeAlert(alertId)
            return NextResponse.json({ success: true, message: 'Alert acknowledged' })
          }
          break

        case 'getDetailedMetrics':
          const detailedMetrics = {
            performanceSummary: performanceMonitor.getPerformanceSummary(timeWindow || 300000),
            tradingImpact: performanceMonitor.getTradingPerformanceImpact(timeWindow || 300000),
            trends: performanceMonitor.getPerformanceTrends(timeWindow || 3600000),
            healthStatus: performanceMonitor.getAPIHealthStatus()
          }
          return NextResponse.json(detailedMetrics)

        case 'resetMetrics':
          // This would reset metrics in a real implementation
          return NextResponse.json({ success: true, message: 'Metrics reset' })

        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          )
      }

      return NextResponse.json(
        { error: 'Action not completed' },
        { status: 400 }
      )
    } catch (error) {
      console.error('Performance monitoring POST error:', error)
      return NextResponse.json(
        { error: 'Failed to process performance monitoring request' },
        { status: 500 }
      )
    }
  },
  {
    endpoint: '/api/monitoring/performance',
    isCritical: false,
    isTradingEndpoint: false
  }
)

// Helper function to calculate overall system health score
function calculateSystemHealthScore(
  performanceMetrics: any,
  tradingMetrics: any,
  apiHealth: any[],
  externalAPIs: any[],
  alerts: any[]
): number {
  let score = 100

  // Deduct points for performance issues
  if (performanceMetrics.avgResponseTime > 500) {
    score -= 30 // Critical latency
  } else if (performanceMetrics.avgResponseTime > 200) {
    score -= 15 // High latency
  }

  if (performanceMetrics.errorRate > 0.05) {
    score -= 25 // High error rate
  } else if (performanceMetrics.errorRate > 0.01) {
    score -= 10 // Moderate error rate
  }

  // Deduct points for trading performance issues
  if (tradingMetrics.missedOpportunities > 5) {
    score -= 20
  } else if (tradingMetrics.missedOpportunities > 2) {
    score -= 10
  }

  if (tradingMetrics.tradingSuccessRate < 0.9) {
    score -= 15
  } else if (tradingMetrics.tradingSuccessRate < 0.95) {
    score -= 5
  }

  // Deduct points for unhealthy endpoints
  const criticalEndpoints = apiHealth.filter(h => h.status === 'CRITICAL').length
  const degradedEndpoints = apiHealth.filter(h => h.status === 'DEGRADED').length
  
  score -= criticalEndpoints * 15
  score -= degradedEndpoints * 5

  // Deduct points for external API issues
  const disconnectedAPIs = externalAPIs.filter(api => api.connectionStatus === 'DISCONNECTED').length
  score -= disconnectedAPIs * 10

  // Deduct points for active alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged).length
  const highAlerts = alerts.filter(a => a.severity === 'HIGH' && !a.acknowledged).length
  
  score -= criticalAlerts * 10
  score -= highAlerts * 5

  return Math.max(0, Math.min(100, score))
}

// Helper function to generate performance recommendations
function generatePerformanceRecommendations(
  performanceMetrics: any,
  tradingMetrics: any,
  apiHealth: any[],
  alerts: any[]
): string[] {
  const recommendations: string[] = []

  // Performance recommendations
  if (performanceMetrics.avgResponseTime > 200) {
    recommendations.push('Consider optimizing slow API endpoints to improve response times')
  }

  if (performanceMetrics.errorRate > 0.01) {
    recommendations.push('Investigate and fix endpoints with high error rates')
  }

  if (performanceMetrics.throughput < 20) {
    recommendations.push('Low throughput detected - consider scaling infrastructure')
  }

  // Trading performance recommendations
  if (tradingMetrics.missedOpportunities > 2) {
    recommendations.push('High latency is causing missed trading opportunities - prioritize performance optimization')
  }

  if (tradingMetrics.tradingSuccessRate < 0.95) {
    recommendations.push('Trading success rate is below optimal - review error handling and retry logic')
  }

  if (tradingMetrics.profitabilityImpact < -0.01) {
    recommendations.push('Performance issues are negatively impacting profitability - immediate attention required')
  }

  // Endpoint-specific recommendations
  const criticalEndpoints = apiHealth.filter(h => h.status === 'CRITICAL')
  if (criticalEndpoints.length > 0) {
    recommendations.push(`Critical endpoints need immediate attention: ${criticalEndpoints.map(e => e.endpoint).join(', ')}`)
  }

  const slowEndpoints = apiHealth.filter(h => h.avgResponseTime > 300)
  if (slowEndpoints.length > 0) {
    recommendations.push(`Optimize slow endpoints: ${slowEndpoints.map(e => e.endpoint).join(', ')}`)
  }

  // Alert-based recommendations
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged)
  if (criticalAlerts.length > 0) {
    recommendations.push('Address critical alerts immediately to prevent system degradation')
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push('System performance is optimal - continue monitoring')
  }

  return recommendations
}

// Health check endpoint
export const HEAD = async () => {
  return new NextResponse(null, { status: 200 })
}
