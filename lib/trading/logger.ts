/**
 * Comprehensive Logging System for CryptoTrader
 * Implements structured logging with correlation IDs and performance metrics
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  operation?: string;
  symbol?: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  bufferSize: number;
  flushInterval: number;
}

export class Logger {
  private readonly config: LoggerConfig;
  private readonly buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableRemote: false,
      bufferSize: 100,
      flushInterval: 5000,
      ...config
    };

    if (this.config.enableRemote || this.config.enableFile) {
      this.startFlushTimer();
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: Record<string, any>, error?: Error): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    } : undefined;

    this.log(LogLevel.ERROR, message, metadata, errorData);
  }

  critical(message: string, metadata?: Record<string, any>, error?: Error): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    } : undefined;

    this.log(LogLevel.CRITICAL, message, metadata, errorData);
    
    // Immediately flush critical logs
    this.flush();
  }

  // Performance logging
  startTimer(operation: string, metadata?: Record<string, any>): () => void {
    const startTime = Date.now();
    const correlationId = metadata?.correlationId || this.generateCorrelationId();
    
    this.debug(`Starting ${operation}`, { 
      ...metadata, 
      correlationId,
      operation,
      startTime 
    });

    return () => {
      const duration = Date.now() - startTime;
      this.info(`Completed ${operation}`, {
        ...metadata,
        correlationId,
        operation,
        duration,
        endTime: Date.now()
      });
    };
  }

  // Trading-specific logging methods
  logTrade(action: string, symbol: string, metadata: Record<string, any>): void {
    this.info(`Trade ${action}`, {
      ...metadata,
      symbol,
      operation: 'trade',
      action
    });
  }

  logAPICall(method: string, endpoint: string, statusCode: number, duration: number, metadata?: Record<string, any>): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `API ${method} ${endpoint}`, {
      ...metadata,
      method,
      endpoint,
      statusCode,
      duration,
      operation: 'api_call'
    });
  }

  logRiskEvent(event: string, symbol: string, metadata: Record<string, any>): void {
    this.warn(`Risk event: ${event}`, {
      ...metadata,
      symbol,
      operation: 'risk_management',
      event
    });
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: any): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      correlationId: metadata?.correlationId,
      userId: metadata?.userId,
      operation: metadata?.operation,
      symbol: metadata?.symbol,
      duration: metadata?.duration,
      metadata,
      error
    };

    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.config.enableFile || this.config.enableRemote) {
      this.buffer.push(entry);
      
      if (this.buffer.length >= this.config.bufferSize) {
        this.flush();
      }
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const correlationId = entry.correlationId ? `[${entry.correlationId}]` : '';
    
    let logMessage = `${timestamp} ${levelName} ${correlationId} ${entry.message}`;
    
    if (entry.metadata) {
      logMessage += ` ${JSON.stringify(entry.metadata)}`;
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(logMessage);
        if (entry.error) {
          console.error('Error details:', entry.error);
        }
        break;
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer.length = 0;

    try {
      if (this.config.enableFile) {
        await this.writeToFile(entries);
      }

      if (this.config.enableRemote && this.config.remoteEndpoint) {
        await this.sendToRemote(entries);
      }
    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Re-add entries to buffer for retry
      this.buffer.unshift(...entries);
    }
  }

  private async writeToFile(entries: LogEntry[]): Promise<void> {
    // Implementation would depend on the environment (Node.js vs browser)
    // For now, we'll just log to console as fallback
    console.log('Writing to file:', entries.length, 'entries');
  }

  private async sendToRemote(entries: LogEntry[]): Promise<void> {
    if (!this.config.remoteEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: entries })
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send logs to remote endpoint:', error);
      throw error;
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup method
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}

// Singleton logger instance
let globalLogger: Logger;

export function getLogger(config?: Partial<LoggerConfig>): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private readonly logger: Logger;
  private readonly metrics: Map<string, number[]> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push(value);
    
    this.logger.info(`Metric recorded: ${name}`, {
      ...metadata,
      metricName: name,
      value,
      operation: 'metric'
    });
  }

  getMetricStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}
