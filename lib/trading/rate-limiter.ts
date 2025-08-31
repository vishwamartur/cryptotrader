/**
 * Intelligent Rate Limiting and API Management System
 * Implements adaptive rate limiting, request queuing, and priority handling
 */

import { Logger } from './logger';
import { RateLimitError, TradingError } from './errors';

export enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
  queueSize: number;
  adaptiveEnabled: boolean;
  warningThreshold: number; // Percentage of limit before warning
}

export interface QueuedRequest {
  id: string;
  priority: RequestPriority;
  operation: string;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  execute: () => Promise<any>;
  metadata?: Record<string, any>;
}

export interface RateLimitState {
  requestsInSecond: number;
  requestsInMinute: number;
  requestsInHour: number;
  lastSecondReset: number;
  lastMinuteReset: number;
  lastHourReset: number;
  queueLength: number;
  isAdaptive: boolean;
  currentLimit: number;
}

export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly logger: Logger;
  private readonly queue: QueuedRequest[] = [];
  private readonly state: RateLimitState;
  private processingQueue = false;
  private adaptiveMultiplier = 1.0;
  private lastAdaptiveAdjustment = 0;

  constructor(config: RateLimitConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    const now = Date.now();
    this.state = {
      requestsInSecond: 0,
      requestsInMinute: 0,
      requestsInHour: 0,
      lastSecondReset: now,
      lastMinuteReset: now,
      lastHourReset: now,
      queueLength: 0,
      isAdaptive: config.adaptiveEnabled,
      currentLimit: config.requestsPerSecond
    };

    this.startQueueProcessor();
  }

  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    priority: RequestPriority = RequestPriority.NORMAL,
    metadata?: Record<string, any>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: this.generateRequestId(),
        priority,
        operation: operationName,
        timestamp: Date.now(),
        resolve,
        reject,
        execute: operation,
        metadata
      };

      this.enqueueRequest(request);
    });
  }

  private enqueueRequest(request: QueuedRequest): void {
    if (this.queue.length >= this.config.queueSize) {
      const error = new RateLimitError(
        'Request queue is full',
        undefined,
        { 
          operation: request.operation,
          queueSize: this.queue.length,
          maxQueueSize: this.config.queueSize
        }
      );
      request.reject(error);
      return;
    }

    // Insert request based on priority
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < request.priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, request);
    this.state.queueLength = this.queue.length;

    this.logger.debug('Request enqueued', {
      requestId: request.id,
      operation: request.operation,
      priority: RequestPriority[request.priority],
      queuePosition: insertIndex,
      queueLength: this.queue.length
    });

    // Check if we're approaching limits
    this.checkWarningThresholds();
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    while (this.processingQueue) {
      try {
        await this.processNextRequest();
        await this.sleep(this.calculateDelay());
      } catch (error) {
        this.logger.error('Queue processor error', {}, error as Error);
        await this.sleep(1000); // Wait 1 second on error
      }
    }
  }

  private async processNextRequest(): Promise<void> {
    if (this.queue.length === 0) {
      await this.sleep(100); // Short wait when queue is empty
      return;
    }

    this.updateCounters();

    if (!this.canMakeRequest()) {
      await this.sleep(this.calculateWaitTime());
      return;
    }

    const request = this.queue.shift()!;
    this.state.queueLength = this.queue.length;

    const startTime = Date.now();
    
    try {
      this.logger.debug('Executing request', {
        requestId: request.id,
        operation: request.operation,
        priority: RequestPriority[request.priority],
        waitTime: startTime - request.timestamp
      });

      const result = await request.execute();
      const duration = Date.now() - startTime;

      this.incrementCounters();
      this.updateAdaptiveLimit(true, duration);

      this.logger.info('Request completed successfully', {
        requestId: request.id,
        operation: request.operation,
        duration,
        ...request.metadata
      });

      request.resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.incrementCounters(); // Still count failed requests
      this.updateAdaptiveLimit(false, duration);

      this.logger.error('Request failed', {
        requestId: request.id,
        operation: request.operation,
        duration,
        error: (error as Error).message,
        ...request.metadata
      }, error as Error);

      request.reject(error as Error);
    }
  }

  private canMakeRequest(): boolean {
    const currentLimit = Math.floor(this.config.requestsPerSecond * this.adaptiveMultiplier);
    
    return this.state.requestsInSecond < currentLimit &&
           this.state.requestsInMinute < this.config.requestsPerMinute &&
           this.state.requestsInHour < this.config.requestsPerHour;
  }

  private calculateWaitTime(): number {
    const secondsUntilReset = 1000 - (Date.now() - this.state.lastSecondReset);
    const minutesUntilReset = 60000 - (Date.now() - this.state.lastMinuteReset);
    const hoursUntilReset = 3600000 - (Date.now() - this.state.lastHourReset);

    return Math.min(secondsUntilReset, minutesUntilReset, hoursUntilReset);
  }

  private calculateDelay(): number {
    const baseDelay = 1000 / (this.config.requestsPerSecond * this.adaptiveMultiplier);
    const queueFactor = Math.min(this.queue.length / 10, 2); // Max 2x delay based on queue
    return Math.max(baseDelay * (1 + queueFactor), 10); // Minimum 10ms delay
  }

  private updateCounters(): void {
    const now = Date.now();

    // Reset second counter
    if (now - this.state.lastSecondReset >= 1000) {
      this.state.requestsInSecond = 0;
      this.state.lastSecondReset = now;
    }

    // Reset minute counter
    if (now - this.state.lastMinuteReset >= 60000) {
      this.state.requestsInMinute = 0;
      this.state.lastMinuteReset = now;
    }

    // Reset hour counter
    if (now - this.state.lastHourReset >= 3600000) {
      this.state.requestsInHour = 0;
      this.state.lastHourReset = now;
    }
  }

  private incrementCounters(): void {
    this.state.requestsInSecond++;
    this.state.requestsInMinute++;
    this.state.requestsInHour++;
  }

  private updateAdaptiveLimit(success: boolean, duration: number): void {
    if (!this.config.adaptiveEnabled) {
      return;
    }

    const now = Date.now();
    if (now - this.lastAdaptiveAdjustment < 10000) { // Adjust at most every 10 seconds
      return;
    }

    const oldMultiplier = this.adaptiveMultiplier;

    if (success && duration < 1000) { // Fast successful request
      this.adaptiveMultiplier = Math.min(this.adaptiveMultiplier * 1.1, 2.0);
    } else if (!success || duration > 5000) { // Failed or slow request
      this.adaptiveMultiplier = Math.max(this.adaptiveMultiplier * 0.9, 0.5);
    }

    if (Math.abs(this.adaptiveMultiplier - oldMultiplier) > 0.01) {
      this.state.currentLimit = Math.floor(this.config.requestsPerSecond * this.adaptiveMultiplier);
      this.lastAdaptiveAdjustment = now;

      this.logger.info('Adaptive rate limit adjusted', {
        oldMultiplier,
        newMultiplier: this.adaptiveMultiplier,
        newLimit: this.state.currentLimit,
        reason: success ? 'success' : 'failure',
        duration
      });
    }
  }

  private checkWarningThresholds(): void {
    const secondThreshold = this.config.requestsPerSecond * (this.config.warningThreshold / 100);
    const minuteThreshold = this.config.requestsPerMinute * (this.config.warningThreshold / 100);
    const hourThreshold = this.config.requestsPerHour * (this.config.warningThreshold / 100);

    if (this.state.requestsInSecond >= secondThreshold ||
        this.state.requestsInMinute >= minuteThreshold ||
        this.state.requestsInHour >= hourThreshold) {
      
      this.logger.warn('Approaching rate limit', {
        requestsInSecond: this.state.requestsInSecond,
        requestsInMinute: this.state.requestsInMinute,
        requestsInHour: this.state.requestsInHour,
        limits: {
          second: this.config.requestsPerSecond,
          minute: this.config.requestsPerMinute,
          hour: this.config.requestsPerHour
        },
        queueLength: this.queue.length
      });
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for monitoring
  getState(): RateLimitState {
    return { ...this.state };
  }

  getQueueInfo(): { length: number; priorities: Record<string, number> } {
    const priorities: Record<string, number> = {};
    
    this.queue.forEach(req => {
      const priorityName = RequestPriority[req.priority];
      priorities[priorityName] = (priorities[priorityName] || 0) + 1;
    });

    return {
      length: this.queue.length,
      priorities
    };
  }

  clearQueue(): void {
    const clearedRequests = this.queue.splice(0);
    clearedRequests.forEach(req => {
      req.reject(new TradingError(
        'Request cancelled due to queue clear',
        'SYSTEM_ERROR' as any,
        'MEDIUM' as any,
        { operation: req.operation }
      ));
    });
    
    this.state.queueLength = 0;
    this.logger.warn('Request queue cleared', { clearedCount: clearedRequests.length });
  }

  stop(): void {
    this.processingQueue = false;
    this.clearQueue();
  }
}

// Default configurations for different API endpoints
export const DELTA_EXCHANGE_RATE_LIMITS: RateLimitConfig = {
  requestsPerSecond: 10,
  requestsPerMinute: 300,
  requestsPerHour: 6000,
  burstLimit: 20,
  queueSize: 1000,
  adaptiveEnabled: true,
  warningThreshold: 80
};

export const CRITICAL_TRADING_RATE_LIMITS: RateLimitConfig = {
  requestsPerSecond: 5,
  requestsPerMinute: 100,
  requestsPerHour: 1000,
  burstLimit: 10,
  queueSize: 500,
  adaptiveEnabled: true,
  warningThreshold: 70
};
