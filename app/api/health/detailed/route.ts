/**
 * Detailed Health Check API with Trading Best Practices
 * Comprehensive system health monitoring for production deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/trading/logger';
import { getMonitoring } from '@/lib/trading/monitoring';
import { generateCorrelationId } from '@/lib/trading/errors';

const logger = getLogger();
const monitoring = getMonitoring();

// Health check configuration
const HEALTH_CHECK_CONFIG = {
  timeout: 5000,
  criticalServices: ['database', 'redis', 'delta_api'],
  thresholds: {
    memoryUsage: 0.9,
    cpuUsage: 0.8,
    responseTime: 1000,
    errorRate: 0.05
  }
};

export async function GET(request: NextRequest) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  try {
    logger.debug('Detailed health check initiated', { correlationId });

    // Perform comprehensive health checks
    const [
      databaseCheck,
      redisCheck,
      deltaAPICheck,
      systemCheck,
      monitoringCheck,
      rateLimitCheck
    ] = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkDeltaAPI(),
      checkSystemResources(),
      checkMonitoring(),
      checkRateLimit()
    ]);

    const healthStatus = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      timestamp: Date.now(),
      correlationId,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: getCheckResult(databaseCheck),
        redis: getCheckResult(redisCheck),
        delta_api: getCheckResult(deltaAPICheck),
        system: getCheckResult(systemCheck),
        monitoring: getCheckResult(monitoringCheck),
        rate_limit: getCheckResult(rateLimitCheck)
      },
      metrics: {
        responseTime: Date.now() - startTime,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      alerts: monitoring.getActiveAlerts().map(alert => ({
        id: alert.id,
        severity: alert.severity,
        title: alert.title,
        age: Date.now() - alert.timestamp
      })),
      systemStatus: monitoring.getSystemStatus()
    };

    // Determine overall health
    const criticalFailures = HEALTH_CHECK_CONFIG.criticalServices.filter(
      service => healthStatus.checks[service]?.status === 'unhealthy'
    );

    const degradedServices = Object.values(healthStatus.checks).filter(
      check => check?.status === 'degraded'
    );

    if (criticalFailures.length > 0) {
      healthStatus.status = 'unhealthy';
    } else if (degradedServices.length > 0) {
      healthStatus.status = 'degraded';
    }

    logger.info('Detailed health check completed', {
      correlationId,
      status: healthStatus.status,
      responseTime: healthStatus.metrics.responseTime,
      criticalFailures: criticalFailures.length
    });

    const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    return NextResponse.json(healthStatus, { status: httpStatus });

  } catch (error) {
    logger.error('Detailed health check failed', {
      correlationId,
      error: (error as Error).message
    }, error as Error);

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: Date.now(),
      correlationId,
      error: (error as Error).message
    }, { status: 503 });
  }
}

// Individual health check functions
async function checkDatabase(): Promise<{ status: string; message?: string; responseTime?: number }> {
  const startTime = Date.now();
  
  try {
    // Mock database connectivity check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    const responseTime = Date.now() - startTime;
    
    if (responseTime > 1000) {
      return {
        status: 'degraded',
        message: 'Database response time is high',
        responseTime
      };
    }

    return {
      status: 'healthy',
      responseTime
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database check failed: ${(error as Error).message}`,
      responseTime: Date.now() - startTime
    };
  }
}

async function checkRedis(): Promise<{ status: string; message?: string; responseTime?: number }> {
  const startTime = Date.now();
  
  try {
    // Mock Redis connectivity check
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Redis check failed: ${(error as Error).message}`,
      responseTime: Date.now() - startTime
    };
  }
}

async function checkDeltaAPI(): Promise<{ status: string; message?: string; responseTime?: number }> {
  const startTime = Date.now();
  
  try {
    // Mock Delta Exchange API connectivity check
    const mockLatency = Math.random() * 500;
    await new Promise(resolve => setTimeout(resolve, mockLatency));
    
    const responseTime = Date.now() - startTime;
    
    if (responseTime > 2000) {
      return {
        status: 'degraded',
        message: 'Delta API response time is high',
        responseTime
      };
    }

    return {
      status: 'healthy',
      responseTime
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Delta API check failed: ${(error as Error).message}`,
      responseTime: Date.now() - startTime
    };
  }
}

async function checkSystemResources(): Promise<{ status: string; message?: string; metrics?: any }> {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    // Mock CPU usage
    const cpuUsage = Math.random() * 0.8;
    
    const metrics = {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        ratio: memoryUsageRatio
      },
      cpu: {
        usage: cpuUsage
      }
    };

    if (memoryUsageRatio > HEALTH_CHECK_CONFIG.thresholds.memoryUsage ||
        cpuUsage > HEALTH_CHECK_CONFIG.thresholds.cpuUsage) {
      return {
        status: 'degraded',
        message: 'High resource usage detected',
        metrics
      };
    }

    return {
      status: 'healthy',
      metrics
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `System resource check failed: ${(error as Error).message}`
    };
  }
}

async function checkMonitoring(): Promise<{ status: string; message?: string }> {
  try {
    const systemStatus = monitoring.getSystemStatus();
    const criticalAlerts = systemStatus.alerts.critical;
    
    if (criticalAlerts > 0) {
      return {
        status: 'degraded',
        message: `${criticalAlerts} critical alerts active`
      };
    }

    return {
      status: 'healthy'
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: `Monitoring check failed: ${(error as Error).message}`
    };
  }
}

async function checkRateLimit(): Promise<{ status: string; message?: string; metrics?: any }> {
  try {
    // Mock rate limit check
    const currentRate = Math.random() * 100;
    const limit = 100;
    const utilization = currentRate / limit;
    
    const metrics = {
      currentRate,
      limit,
      utilization
    };

    if (utilization > 0.9) {
      return {
        status: 'degraded',
        message: 'Rate limit utilization is high',
        metrics
      };
    }

    return {
      status: 'healthy',
      metrics
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Rate limit check failed: ${(error as Error).message}`
    };
  }
}

function getCheckResult(result: PromiseSettledResult<any>): any {
  if (result.status === 'fulfilled') {
    return result.value;
  } else {
    return {
      status: 'unhealthy',
      message: result.reason?.message || 'Check failed'
    };
  }
}

// Readiness probe endpoint
export async function HEAD(request: NextRequest) {
  try {
    // Quick readiness check for Kubernetes/Docker
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkRedis()
    ]);

    const hasFailures = checks.some(check => 
      check.status === 'rejected' || 
      (check.status === 'fulfilled' && check.value.status === 'unhealthy')
    );

    return new NextResponse(null, { status: hasFailures ? 503 : 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
