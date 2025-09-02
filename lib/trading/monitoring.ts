/**



 * Comprehensive Monitoring and Alerting System



 * Implements real-time monitoring, performance metrics, and alerting



 */







import { Logger, getLogger, PerformanceMonitor } from './logger';



import { TradingError, ErrorSeverity } from './errors';







export enum AlertSeverity {



  INFO = 'INFO',



  WARNING = 'WARNING',



  ERROR = 'ERROR',



  CRITICAL = 'CRITICAL'



}







export enum MetricType {



  COUNTER = 'COUNTER',



  GAUGE = 'GAUGE',



  HISTOGRAM = 'HISTOGRAM',



  TIMER = 'TIMER'



}







export interface Alert {



  id: string;



  timestamp: number;



  severity: AlertSeverity;



  title: string;



  message: string;



  source: string;



  metadata?: Record<string, any>;



  acknowledged: boolean;



  resolvedAt?: number;



}







export interface Metric {



  name: string;



  type: MetricType;



  value: number;



  timestamp: number;



  labels?: Record<string, string>;



  metadata?: Record<string, any>;



}







export interface HealthCheck {



  name: string;



  status: 'healthy' | 'degraded' | 'unhealthy';



  lastCheck: number;



  duration: number;



  message?: string;



  metadata?: Record<string, any>;



}



<<<<<<<


=======
  // Cleanup method to prevent memory leaks

  cleanup(): void {

    if (this.healthCheckInterval) {

      clearInterval(this.healthCheckInterval);

      this.healthCheckInterval = null;

    }

  }



  // Private methods

  private startHealthChecks(): void {

    this.healthCheckInterval = setInterval(async () => {

      const healthCheckPromises = Array.from(this.healthChecks.keys()).map(name =>

        this.runHealthCheck(name)

      );



      await Promise.allSettled(healthCheckPromises);

    }, this.config.healthCheckInterval);

  }

>>>>>>>


export interface MonitoringConfig {



  enableRealTimeAlerts: boolean;



  enableMetricsCollection: boolean;



  enableHealthChecks: boolean;



  alertThresholds: {



    errorRate: number;



    responseTime: number;



    queueLength: number;



    memoryUsage: number;



  };



  healthCheckInterval: number;



  metricsRetentionPeriod: number;



}







export class MonitoringSystem {



  private readonly config: MonitoringConfig;



  private readonly logger: Logger;



  private readonly performanceMonitor: PerformanceMonitor;



  private readonly alerts: Map<string, Alert> = new Map();



  private readonly metrics: Map<string, Metric[]> = new Map();



  private readonly healthChecks: Map<string, HealthCheck> = new Map();



  private readonly alertHandlers: ((alert: Alert) => void)[] = [];



  private healthCheckInterval?: NodeJS.Timeout;







  constructor(config: Partial<MonitoringConfig> = {}) {



    this.config = {



      enableRealTimeAlerts: true,



      enableMetricsCollection: true,



      enableHealthChecks: true,



      alertThresholds: {



        errorRate: 0.05, // 5%



        responseTime: 5000, // 5 seconds



        queueLength: 100,



        memoryUsage: 0.8 // 80%



      },



      healthCheckInterval: 30000, // 30 seconds



      metricsRetentionPeriod: 3600000, // 1 hour



      ...config



    };







    this.logger = getLogger();



    this.performanceMonitor = new PerformanceMonitor(this.logger);







    if (this.config.enableHealthChecks) {



      this.startHealthChecks();



    }



  }







  // Alert Management



  createAlert(



    severity: AlertSeverity,



    title: string,



    message: string,



    source: string,



    metadata?: Record<string, any>



  ): Alert {



    const alert: Alert = {



      id: this.generateAlertId(),



      timestamp: Date.now(),



      severity,



      title,



      message,



      source,



      metadata,



      acknowledged: false



    };







    this.alerts.set(alert.id, alert);







    this.logger.warn('Alert created', {



      alertId: alert.id,



      severity,



      title,



      source,



      ...metadata



    });







    if (this.config.enableRealTimeAlerts) {



      this.notifyAlertHandlers(alert);



    }







    return alert;



  }







  acknowledgeAlert(alertId: string): boolean {



    const alert = this.alerts.get(alertId);



    if (!alert) {



      return false;



    }







    alert.acknowledged = true;



    this.logger.info('Alert acknowledged', { alertId, title: alert.title });



    return true;



  }







  resolveAlert(alertId: string): boolean {



    const alert = this.alerts.get(alertId);



    if (!alert) {



      return false;



    }







    alert.resolvedAt = Date.now();



    this.logger.info('Alert resolved', { 



      alertId, 



      title: alert.title,



      duration: alert.resolvedAt - alert.timestamp



    });



    return true;



  }







  getActiveAlerts(): Alert[] {



    return Array.from(this.alerts.values())



      .filter(alert => !alert.resolvedAt)



      .sort((a, b) => {



        // Sort by severity first, then by timestamp



        const severityOrder = { CRITICAL: 4, ERROR: 3, WARNING: 2, INFO: 1 };



        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];



        return severityDiff !== 0 ? severityDiff : b.timestamp - a.timestamp;



      });



  }







  // Metrics Collection



  recordMetric(



    name: string,



    type: MetricType,



    value: number,



    labels?: Record<string, string>,



    metadata?: Record<string, any>



  ): void {



    if (!this.config.enableMetricsCollection) {



      return;



    }







    const metric: Metric = {



      name,



      type,



      value,



      timestamp: Date.now(),



      labels,



      metadata



    };







    if (!this.metrics.has(name)) {



      this.metrics.set(name, []);



    }







    this.metrics.get(name)!.push(metric);



    this.performanceMonitor.recordMetric(name, value, { labels, ...metadata });







    // Clean up old metrics



    this.cleanupOldMetrics(name);







    // Check for threshold violations



    this.checkMetricThresholds(name, value, type);



  }







  getMetrics(name: string, timeRange?: { start: number; end: number }): Metric[] {



    const metrics = this.metrics.get(name) || [];



    



    if (!timeRange) {



      return metrics;



    }







    return metrics.filter(metric => 



      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end



    );



  }







  getMetricStats(name: string): { avg: number; min: number; max: number; count: number } | null {



    return this.performanceMonitor.getMetricStats(name);



  }







  // Health Checks



  registerHealthCheck(



    name: string,



    checkFunction: () => Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string; metadata?: Record<string, any> }>



  ): void {



    const healthCheck: HealthCheck = {



      name,



      status: 'healthy',



      lastCheck: 0,



      duration: 0



    };







    this.healthChecks.set(name, healthCheck);







    // Store the check function for later execution



    (healthCheck as any).checkFunction = checkFunction;



  }







  async runHealthCheck(name: string): Promise<HealthCheck | null> {



    const healthCheck = this.healthChecks.get(name);



    if (!healthCheck || !(healthCheck as any).checkFunction) {



      return null;



    }







    const startTime = Date.now();



    



    try {



      const result = await (healthCheck as any).checkFunction();



      



      healthCheck.status = result.status;



      healthCheck.message = result.message;



      healthCheck.metadata = result.metadata;



      healthCheck.lastCheck = Date.now();



      healthCheck.duration = healthCheck.lastCheck - startTime;







      this.logger.debug('Health check completed', {



        name,



        status: result.status,



        duration: healthCheck.duration



      });







      // Create alert if health check failed



      if (result.status === 'unhealthy') {



        this.createAlert(



          AlertSeverity.ERROR,



          `Health Check Failed: ${name}`,



          result.message || 'Health check returned unhealthy status',



          'health_check',



          { healthCheckName: name, ...result.metadata }



        );



      }







      return healthCheck;



    } catch (error) {



      healthCheck.status = 'unhealthy';



      healthCheck.message = (error as Error).message;



      healthCheck.lastCheck = Date.now();



      healthCheck.duration = healthCheck.lastCheck - startTime;







      this.logger.error('Health check failed', {



        name,



        error: (error as Error).message,



        duration: healthCheck.duration



      }, error as Error);







      this.createAlert(



        AlertSeverity.CRITICAL,



        `Health Check Error: ${name}`,



        `Health check threw an error: ${(error as Error).message}`,



        'health_check',



        { healthCheckName: name, error: (error as Error).message }



      );







      return healthCheck;



    }



  }







  getAllHealthChecks(): HealthCheck[] {



    return Array.from(this.healthChecks.values());



  }







  // Trading-specific monitoring methods



  monitorTradingOperation(



    operation: string,



    symbol: string,



    result: 'success' | 'failure',



    duration: number,



    metadata?: Record<string, any>



  ): void {



    this.recordMetric(



      'trading_operations',



      MetricType.COUNTER,



      1,



      { operation, symbol, result },



      { duration, ...metadata }



    );







    if (result === 'failure') {



      this.createAlert(



        AlertSeverity.WARNING,



        `Trading Operation Failed`,



        `${operation} failed for ${symbol}`,



        'trading',



        { operation, symbol, duration, ...metadata }



      );



    }



  }







  monitorAPICall(



    endpoint: string,



    method: string,



    statusCode: number,



    duration: number,



    metadata?: Record<string, any>



  ): void {



    this.recordMetric(



      'api_calls',



      MetricType.COUNTER,



      1,



      { endpoint, method, status: statusCode.toString() },



      { duration, ...metadata }



    );







    this.recordMetric(



      'api_response_time',



      MetricType.TIMER,



      duration,



      { endpoint, method },



      metadata



    );







    // Alert on high error rates or slow responses



    if (statusCode >= 400) {



      this.createAlert(



        statusCode >= 500 ? AlertSeverity.ERROR : AlertSeverity.WARNING,



        `API Error`,



        `${method} ${endpoint} returned ${statusCode}`,



        'api',



        { endpoint, method, statusCode, duration, ...metadata }



      );



    }



  }







  monitorRiskEvent(



    event: string,



    symbol: string,



    severity: 'low' | 'medium' | 'high' | 'critical',



    metadata?: Record<string, any>



  ): void {



    const alertSeverity = {



      low: AlertSeverity.INFO,



      medium: AlertSeverity.WARNING,



      high: AlertSeverity.ERROR,



      critical: AlertSeverity.CRITICAL



    }[severity];







    this.recordMetric(



      'risk_events',



      MetricType.COUNTER,



      1,



      { event, symbol, severity },



      metadata



    );







    this.createAlert(



      alertSeverity,



      `Risk Event: ${event}`,



      `Risk event detected for ${symbol}`,



      'risk_management',



      { event, symbol, severity, ...metadata }



    );



  }







  // Private methods



  private startHealthChecks(): void {



    this.healthCheckInterval = setInterval(async () => {



      const healthCheckPromises = Array.from(this.healthChecks.keys()).map(name =>



        this.runHealthCheck(name)



      );



      



      await Promise.allSettled(healthCheckPromises);



    }, this.config.healthCheckInterval);



  }







  private cleanupOldMetrics(name: string): void {



    const metrics = this.metrics.get(name);



    if (!metrics) return;







    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;



    const filteredMetrics = metrics.filter(metric => metric.timestamp > cutoffTime);



    



    if (filteredMetrics.length !== metrics.length) {



      this.metrics.set(name, filteredMetrics);



    }



  }







  private checkMetricThresholds(name: string, value: number, type: MetricType): void {



    // Check specific thresholds based on metric name



    if (name === 'api_response_time' && value > this.config.alertThresholds.responseTime) {



      this.createAlert(



        AlertSeverity.WARNING,



        'High Response Time',



        `API response time exceeded threshold: ${value}ms`,



        'performance',



        { metricName: name, value, threshold: this.config.alertThresholds.responseTime }



      );



    }







    if (name === 'queue_length' && value > this.config.alertThresholds.queueLength) {



      this.createAlert(



        AlertSeverity.WARNING,



        'High Queue Length',



        `Request queue length exceeded threshold: ${value}`,



        'performance',



        { metricName: name, value, threshold: this.config.alertThresholds.queueLength }



      );



    }



  }







  private generateAlertId(): string {



    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;



  }







  private notifyAlertHandlers(alert: Alert): void {



    this.alertHandlers.forEach(handler => {



      try {



        handler(alert);



      } catch (error) {



        this.logger.error('Alert handler failed', {



          alertId: alert.id,



          error: (error as Error).message



        }, error as Error);



      }



    });



  }







  // Public utility methods



  addAlertHandler(handler: (alert: Alert) => void): void {



    this.alertHandlers.push(handler);



  }







  removeAlertHandler(handler: (alert: Alert) => void): void {



    const index = this.alertHandlers.indexOf(handler);



    if (index > -1) {



      this.alertHandlers.splice(index, 1);



    }



  }







  getSystemStatus(): {



    alerts: { total: number; critical: number; error: number; warning: number };



    healthChecks: { total: number; healthy: number; degraded: number; unhealthy: number };



    metrics: { totalMetrics: number; totalDataPoints: number };



  } {



    const alerts = this.getActiveAlerts();



    const healthChecks = this.getAllHealthChecks();



    



    let totalDataPoints = 0;



    this.metrics.forEach(metricArray => {



      totalDataPoints += metricArray.length;



    });







    return {



      alerts: {



        total: alerts.length,



        critical: alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,



        error: alerts.filter(a => a.severity === AlertSeverity.ERROR).length,



        warning: alerts.filter(a => a.severity === AlertSeverity.WARNING).length



      },



      healthChecks: {



        total: healthChecks.length,



        healthy: healthChecks.filter(h => h.status === 'healthy').length,



        degraded: healthChecks.filter(h => h.status === 'degraded').length,



        unhealthy: healthChecks.filter(h => h.status === 'unhealthy').length



      },



      metrics: {



        totalMetrics: this.metrics.size,



        totalDataPoints



      }



    };



  }







  destroy(): void {



    if (this.healthCheckInterval) {



      clearInterval(this.healthCheckInterval);



    }



    this.alerts.clear();



    this.metrics.clear();



    this.healthChecks.clear();



    this.alertHandlers.length = 0;



    this.logger.info('Monitoring system destroyed');



  }



}







// Singleton monitoring instance



let globalMonitoring: MonitoringSystem;







export function getMonitoring(config?: Partial<MonitoringConfig>): MonitoringSystem {



  if (!globalMonitoring) {



    globalMonitoring = new MonitoringSystem(config);



  }



  return globalMonitoring;



}



