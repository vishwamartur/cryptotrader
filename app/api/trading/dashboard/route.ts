/**
 * Trading Dashboard API Route
 * Provides comprehensive system status, metrics, and monitoring data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/trading/logger';
import { getMonitoring } from '@/lib/trading/monitoring';
import { generateCorrelationId } from '@/lib/trading/errors';

const logger = getLogger();
const monitoring = getMonitoring();

export async function GET(request: NextRequest) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  try {
    logger.info('Dashboard API request initiated', { correlationId });

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeMetrics = searchParams.get('include_metrics') !== 'false';
    const includeAlerts = searchParams.get('include_alerts') !== 'false';
    const includeHealthChecks = searchParams.get('include_health_checks') !== 'false';
    const timeRange = searchParams.get('time_range') || '1h';

    // Calculate time range
    const timeRangeMs = parseTimeRange(timeRange);
    const endTime = Date.now();
    const startTimeRange = endTime - timeRangeMs;

    // Collect system status
    const systemStatus = monitoring.getSystemStatus();

    // Collect active alerts
    let alerts = [];
    if (includeAlerts) {
      alerts = monitoring.getActiveAlerts().map(alert => ({
        id: alert.id,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        source: alert.source,
        timestamp: alert.timestamp,
        acknowledged: alert.acknowledged,
        age: Date.now() - alert.timestamp
      }));
    }

    // Collect health checks
    let healthChecks = [];
    if (includeHealthChecks) {
      healthChecks = monitoring.getAllHealthChecks().map(check => ({
        name: check.name,
        status: check.status,
        lastCheck: check.lastCheck,
        duration: check.duration,
        message: check.message,
        age: Date.now() - check.lastCheck
      }));
    }

    // Collect performance metrics
    let performanceMetrics = {};
    if (includeMetrics) {
      performanceMetrics = {
        apiCalls: {
          total: getMetricValue('api_calls', startTimeRange, endTime),
          success: getMetricValue('api_calls', startTimeRange, endTime, { status: 'success' }),
          errors: getMetricValue('api_calls', startTimeRange, endTime, { status: 'error' }),
          avgResponseTime: getMetricStats('api_response_time')
        },
        trading: {
          totalOperations: getMetricValue('trading_operations', startTimeRange, endTime),
          successfulTrades: getMetricValue('trading_operations', startTimeRange, endTime, { result: 'success' }),
          failedTrades: getMetricValue('trading_operations', startTimeRange, endTime, { result: 'failure' }),
          avgTradeSize: getMetricStats('trade_size')
        },
        riskEvents: {
          total: getMetricValue('risk_events', startTimeRange, endTime),
          byType: {
            stopLoss: getMetricValue('risk_events', startTimeRange, endTime, { event: 'stop_loss_triggered' }),
            drawdown: getMetricValue('risk_events', startTimeRange, endTime, { event: 'drawdown' }),
            correlation: getMetricValue('risk_events', startTimeRange, endTime, { event: 'high_correlation' })
          }
        },
        cache: {
          hits: getMetricValue('api_cache_hits', startTimeRange, endTime),
          misses: getMetricValue('api_cache_misses', startTimeRange, endTime),
          hitRate: calculateCacheHitRate(startTimeRange, endTime)
        }
      };
    }

    // System resource metrics (mock data for demonstration)
    const resourceMetrics = {
      memory: {
        used: Math.floor(Math.random() * 80 + 20), // 20-100%
        available: Math.floor(Math.random() * 80 + 20),
        total: 8192 // MB
      },
      cpu: {
        usage: Math.floor(Math.random() * 60 + 10), // 10-70%
        cores: 4
      },
      network: {
        inbound: Math.floor(Math.random() * 1000 + 100), // KB/s
        outbound: Math.floor(Math.random() * 500 + 50)
      }
    };

    // Rate limiting status (mock data)
    const rateLimitStatus = {
      requestsPerSecond: {
        current: Math.floor(Math.random() * 8 + 2),
        limit: 10,
        utilization: 0.6
      },
      requestsPerMinute: {
        current: Math.floor(Math.random() * 200 + 50),
        limit: 300,
        utilization: 0.4
      },
      queueLength: Math.floor(Math.random() * 5),
      adaptiveMultiplier: 1.0 + (Math.random() - 0.5) * 0.4
    };

    // Trading session summary
    const tradingSession = {
      startTime: Date.now() - (8 * 60 * 60 * 1000), // 8 hours ago
      uptime: 8 * 60 * 60 * 1000,
      totalRequests: Math.floor(Math.random() * 10000 + 5000),
      successRate: 0.95 + Math.random() * 0.04,
      avgResponseTime: 150 + Math.random() * 100,
      peakRequestsPerMinute: Math.floor(Math.random() * 500 + 200)
    };

    const dashboardData = {
      timestamp: Date.now(),
      correlationId,
      timeRange,
      systemStatus,
      alerts: includeAlerts ? alerts : undefined,
      healthChecks: includeHealthChecks ? healthChecks : undefined,
      performanceMetrics: includeMetrics ? performanceMetrics : undefined,
      resourceMetrics,
      rateLimitStatus,
      tradingSession,
      summary: {
        overallHealth: calculateOverallHealth(systemStatus, alerts, healthChecks),
        criticalIssues: alerts.filter(a => a.severity === 'CRITICAL').length,
        warningIssues: alerts.filter(a => a.severity === 'WARNING').length,
        healthyServices: healthChecks.filter(h => h.status === 'healthy').length,
        totalServices: healthChecks.length
      }
    };

    const duration = Date.now() - startTime;

    logger.info('Dashboard data compiled successfully', {
      correlationId,
      duration,
      alertCount: alerts.length,
      healthCheckCount: healthChecks.length,
      overallHealth: dashboardData.summary.overallHealth
    });

    // Record dashboard access metric
    monitoring.recordMetric('dashboard_requests', 'COUNTER' as any, 1, {
      timeRange,
      includeMetrics: includeMetrics.toString(),
      includeAlerts: includeAlerts.toString()
    });

    return NextResponse.json({
      success: true,
      data: dashboardData,
      generatedAt: Date.now(),
      generationTime: duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Dashboard API request failed', {
      correlationId,
      duration,
      error: (error as Error).message
    }, error as Error);

    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'Failed to generate dashboard data',
        correlationId
      }
    }, { status: 500 });
  }
}

// Helper functions
function parseTimeRange(timeRange: string): number {
  const timeRangeMap: Record<string, number> = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };

  return timeRangeMap[timeRange] || timeRangeMap['1h'];
}

function getMetricValue(
  metricName: string, 
  startTime: number, 
  endTime: number, 
  labels?: Record<string, string>
): number {
  // In a real implementation, this would query the monitoring system
  // For now, return mock data
  return Math.floor(Math.random() * 100 + 10);
}

function getMetricStats(metricName: string): { avg: number; min: number; max: number; count: number } | null {
  // Mock metric stats
  return {
    avg: Math.floor(Math.random() * 200 + 100),
    min: Math.floor(Math.random() * 50 + 10),
    max: Math.floor(Math.random() * 500 + 200),
    count: Math.floor(Math.random() * 1000 + 100)
  };
}

function calculateCacheHitRate(startTime: number, endTime: number): number {
  const hits = getMetricValue('api_cache_hits', startTime, endTime);
  const misses = getMetricValue('api_cache_misses', startTime, endTime);
  const total = hits + misses;
  
  return total > 0 ? hits / total : 0;
}

function calculateOverallHealth(
  systemStatus: any,
  alerts: any[],
  healthChecks: any[]
): 'healthy' | 'degraded' | 'unhealthy' {
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
  const errorAlerts = alerts.filter(a => a.severity === 'ERROR').length;
  const unhealthyServices = healthChecks.filter(h => h.status === 'unhealthy').length;
  const degradedServices = healthChecks.filter(h => h.status === 'degraded').length;

  if (criticalAlerts > 0 || unhealthyServices > 0) {
    return 'unhealthy';
  }

  if (errorAlerts > 2 || degradedServices > 1) {
    return 'degraded';
  }

  return 'healthy';
}

// Real-time metrics endpoint
export async function POST(request: NextRequest) {
  const correlationId = generateCorrelationId();

  try {
    const body = await request.json();
    const { action, metricName, value, labels } = body;

    if (action === 'record_metric') {
      monitoring.recordMetric(metricName, 'GAUGE' as any, value, labels);
      
      logger.debug('Custom metric recorded', {
        correlationId,
        metricName,
        value,
        labels
      });

      return NextResponse.json({
        success: true,
        message: 'Metric recorded successfully',
        correlationId
      });
    }

    return NextResponse.json({
      success: false,
      error: {
        type: 'validation_error',
        message: 'Invalid action specified'
      },
      correlationId
    }, { status: 400 });

  } catch (error) {
    logger.error('Dashboard POST request failed', {
      correlationId,
      error: (error as Error).message
    }, error as Error);

    return NextResponse.json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'Failed to process request'
      },
      correlationId
    }, { status: 500 });
  }
}
