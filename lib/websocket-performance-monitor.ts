'use client';

import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  messagesPerSecond: number;
  averageLatency: number;
  memoryUsage: number;
  connectionUptime: number;
  errorRate: number;
  subscriptionCount: number;
  dataStreamHealth: Map<string, StreamHealth>;
  lastUpdated: number;
}

export interface StreamHealth {
  streamType: string;
  messageCount: number;
  lastMessageTime: number;
  averageMessageSize: number;
  errorCount: number;
  isHealthy: boolean;
}

export interface PerformanceAlert {
  type: 'latency' | 'memory' | 'error_rate' | 'connection' | 'stream_health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metrics?: any;
}

export class WebSocketPerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private messageTimestamps: number[] = [];
  private latencyMeasurements: number[] = [];
  private streamHealthMap: Map<string, StreamHealth> = new Map();
  private errorCount = 0;
  private totalMessages = 0;
  private connectionStartTime = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds: AlertThresholds;

  constructor(alertThresholds?: Partial<AlertThresholds>) {
    super();
    
    this.alertThresholds = {
      maxLatency: 1000, // 1 second
      maxMemoryMB: 100, // 100 MB
      maxErrorRate: 0.05, // 5%
      minMessagesPerSecond: 1,
      streamHealthTimeout: 30000, // 30 seconds
      ...alertThresholds
    };

    this.metrics = {
      messagesPerSecond: 0,
      averageLatency: 0,
      memoryUsage: 0,
      connectionUptime: 0,
      errorRate: 0,
      subscriptionCount: 0,
      dataStreamHealth: new Map(),
      lastUpdated: Date.now()
    };

    this.startMonitoring();
  }

  // Start performance monitoring
  startMonitoring(): void {
    this.connectionStartTime = Date.now();
    
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.checkAlerts();
      this.emit('metricsUpdated', this.metrics);
    }, 5000); // Update every 5 seconds
  }

  // Stop performance monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Record message received
  recordMessage(streamType: string, messageSize: number, latency?: number): void {
    const now = Date.now();
    this.totalMessages++;
    this.messageTimestamps.push(now);
    
    // Keep only last 60 seconds of timestamps
    const cutoff = now - 60000;
    this.messageTimestamps = this.messageTimestamps.filter(ts => ts > cutoff);
    
    // Record latency if provided
    if (latency !== undefined) {
      this.latencyMeasurements.push(latency);
      // Keep only last 100 measurements
      if (this.latencyMeasurements.length > 100) {
        this.latencyMeasurements = this.latencyMeasurements.slice(-100);
      }
    }
    
    // Update stream health
    this.updateStreamHealth(streamType, messageSize, now);
  }

  // Record error
  recordError(streamType?: string, error?: Error): void {
    this.errorCount++;
    
    if (streamType) {
      const streamHealth = this.streamHealthMap.get(streamType);
      if (streamHealth) {
        streamHealth.errorCount++;
        streamHealth.isHealthy = this.calculateStreamHealth(streamHealth);
      }
    }
    
    this.emit('error', {
      streamType,
      error,
      timestamp: Date.now(),
      totalErrors: this.errorCount
    });
  }

  // Record subscription change
  recordSubscriptionChange(count: number): void {
    this.metrics.subscriptionCount = count;
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get stream health for specific stream
  getStreamHealth(streamType: string): StreamHealth | null {
    return this.streamHealthMap.get(streamType) || null;
  }

  // Get all stream health data
  getAllStreamHealth(): Map<string, StreamHealth> {
    return new Map(this.streamHealthMap);
  }

  // Update performance metrics
  private updateMetrics(): void {
    const now = Date.now();
    
    // Calculate messages per second
    this.metrics.messagesPerSecond = this.messageTimestamps.length;
    
    // Calculate average latency
    if (this.latencyMeasurements.length > 0) {
      this.metrics.averageLatency = this.latencyMeasurements.reduce((sum, lat) => sum + lat, 0) / this.latencyMeasurements.length;
    }
    
    // Calculate memory usage (if available)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    
    // Calculate connection uptime
    this.metrics.connectionUptime = now - this.connectionStartTime;
    
    // Calculate error rate
    this.metrics.errorRate = this.totalMessages > 0 ? this.errorCount / this.totalMessages : 0;
    
    // Update stream health map
    this.metrics.dataStreamHealth = new Map(this.streamHealthMap);
    
    this.metrics.lastUpdated = now;
  }

  // Update stream health
  private updateStreamHealth(streamType: string, messageSize: number, timestamp: number): void {
    let streamHealth = this.streamHealthMap.get(streamType);
    
    if (!streamHealth) {
      streamHealth = {
        streamType,
        messageCount: 0,
        lastMessageTime: 0,
        averageMessageSize: 0,
        errorCount: 0,
        isHealthy: true
      };
      this.streamHealthMap.set(streamType, streamHealth);
    }
    
    // Update stream metrics
    streamHealth.messageCount++;
    streamHealth.lastMessageTime = timestamp;
    
    // Update average message size (rolling average)
    const alpha = 0.1; // Smoothing factor
    streamHealth.averageMessageSize = streamHealth.averageMessageSize * (1 - alpha) + messageSize * alpha;
    
    // Update health status
    streamHealth.isHealthy = this.calculateStreamHealth(streamHealth);
  }

  // Calculate if stream is healthy
  private calculateStreamHealth(streamHealth: StreamHealth): boolean {
    const now = Date.now();
    const timeSinceLastMessage = now - streamHealth.lastMessageTime;
    
    // Stream is unhealthy if:
    // 1. No messages received in the last 30 seconds (for active streams)
    // 2. Error rate is too high
    const isTimedOut = timeSinceLastMessage > this.alertThresholds.streamHealthTimeout;
    const errorRate = streamHealth.messageCount > 0 ? streamHealth.errorCount / streamHealth.messageCount : 0;
    const hasHighErrorRate = errorRate > this.alertThresholds.maxErrorRate;
    
    return !isTimedOut && !hasHighErrorRate;
  }

  // Check for performance alerts
  private checkAlerts(): void {
    const alerts: PerformanceAlert[] = [];
    
    // Check latency
    if (this.metrics.averageLatency > this.alertThresholds.maxLatency) {
      alerts.push({
        type: 'latency',
        severity: this.metrics.averageLatency > this.alertThresholds.maxLatency * 2 ? 'critical' : 'high',
        message: `High latency detected: ${this.metrics.averageLatency.toFixed(2)}ms`,
        timestamp: Date.now(),
        metrics: { latency: this.metrics.averageLatency }
      });
    }
    
    // Check memory usage
    if (this.metrics.memoryUsage > this.alertThresholds.maxMemoryMB) {
      alerts.push({
        type: 'memory',
        severity: this.metrics.memoryUsage > this.alertThresholds.maxMemoryMB * 2 ? 'critical' : 'high',
        message: `High memory usage: ${this.metrics.memoryUsage.toFixed(2)}MB`,
        timestamp: Date.now(),
        metrics: { memoryUsage: this.metrics.memoryUsage }
      });
    }
    
    // Check error rate
    if (this.metrics.errorRate > this.alertThresholds.maxErrorRate) {
      alerts.push({
        type: 'error_rate',
        severity: this.metrics.errorRate > this.alertThresholds.maxErrorRate * 2 ? 'critical' : 'high',
        message: `High error rate: ${(this.metrics.errorRate * 100).toFixed(2)}%`,
        timestamp: Date.now(),
        metrics: { errorRate: this.metrics.errorRate }
      });
    }
    
    // Check message throughput
    if (this.metrics.messagesPerSecond < this.alertThresholds.minMessagesPerSecond && this.metrics.subscriptionCount > 0) {
      alerts.push({
        type: 'connection',
        severity: 'medium',
        message: `Low message throughput: ${this.metrics.messagesPerSecond} msg/sec`,
        timestamp: Date.now(),
        metrics: { messagesPerSecond: this.metrics.messagesPerSecond }
      });
    }
    
    // Check stream health
    this.streamHealthMap.forEach((streamHealth, streamType) => {
      if (!streamHealth.isHealthy) {
        alerts.push({
          type: 'stream_health',
          severity: 'medium',
          message: `Unhealthy stream: ${streamType}`,
          timestamp: Date.now(),
          metrics: { streamHealth }
        });
      }
    });
    
    // Emit alerts
    alerts.forEach(alert => {
      this.emit('alert', alert);
    });
  }

  // Get performance summary
  getPerformanceSummary(): string {
    const uptime = Math.floor(this.metrics.connectionUptime / 1000);
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
    
    return `
Performance Summary:
- Uptime: ${uptimeStr}
- Messages/sec: ${this.metrics.messagesPerSecond}
- Avg Latency: ${this.metrics.averageLatency.toFixed(2)}ms
- Memory Usage: ${this.metrics.memoryUsage.toFixed(2)}MB
- Error Rate: ${(this.metrics.errorRate * 100).toFixed(2)}%
- Active Streams: ${this.streamHealthMap.size}
- Subscriptions: ${this.metrics.subscriptionCount}
    `.trim();
  }

  // Reset metrics
  reset(): void {
    this.messageTimestamps = [];
    this.latencyMeasurements = [];
    this.streamHealthMap.clear();
    this.errorCount = 0;
    this.totalMessages = 0;
    this.connectionStartTime = Date.now();
    
    this.metrics = {
      messagesPerSecond: 0,
      averageLatency: 0,
      memoryUsage: 0,
      connectionUptime: 0,
      errorRate: 0,
      subscriptionCount: 0,
      dataStreamHealth: new Map(),
      lastUpdated: Date.now()
    };
  }
}

interface AlertThresholds {
  maxLatency: number;
  maxMemoryMB: number;
  maxErrorRate: number;
  minMessagesPerSecond: number;
  streamHealthTimeout: number;
}

// Factory function
export function createPerformanceMonitor(alertThresholds?: Partial<AlertThresholds>): WebSocketPerformanceMonitor {
  return new WebSocketPerformanceMonitor(alertThresholds);
}
