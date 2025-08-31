/**
 * Retry Handler with Exponential Backoff and Circuit Breaker
 * Implements intelligent retry logic for trading operations
 */

import { TradingError, isRetryableError, RateLimitError, generateCorrelationId } from './errors';
import { Logger } from './logger';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrors?: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly logger: Logger;

  constructor(config: CircuitBreakerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.config.recoveryTimeout) {
        throw new TradingError(
          `Circuit breaker is OPEN for ${operationName}`,
          'SYSTEM_ERROR' as any,
          'HIGH' as any,
          { operation: operationName }
        );
      }
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenCalls = 0;
    }

    if (this.state === CircuitState.HALF_OPEN && 
        this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new TradingError(
        `Circuit breaker HALF_OPEN limit exceeded for ${operationName}`,
        'SYSTEM_ERROR' as any,
        'HIGH' as any,
        { operation: operationName }
      );
    }

    try {
      const result = await operation();
      this.onSuccess(operationName);
      return result;
    } catch (error) {
      this.onFailure(error, operationName);
      throw error;
    }
  }

  private onSuccess(operationName: string): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.logger.info('Circuit breaker closed', { operation: operationName });
    }
  }

  private onFailure(error: any, operationName: string): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.logger.warn('Circuit breaker opened from half-open', {
        operation: operationName,
        error: error.message
      });
      return;
    }

    if (this.state === CircuitState.CLOSED && 
        this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.error('Circuit breaker opened', {
        operation: operationName,
        failureCount: this.failureCount,
        error: error.message
      });
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls
    };
  }
}

export class RetryHandler {
  private readonly config: RetryConfig;
  private readonly circuitBreaker?: CircuitBreaker;
  private readonly logger: Logger;

  constructor(
    config: RetryConfig,
    logger: Logger,
    circuitBreakerConfig?: CircuitBreakerConfig
  ) {
    this.config = config;
    this.logger = logger;
    
    if (circuitBreakerConfig) {
      this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig, logger);
    }
  }

  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, any> = {}
  ): Promise<T> {
    const correlationId = generateCorrelationId();
    const operationWithCircuitBreaker = this.circuitBreaker
      ? () => this.circuitBreaker!.execute(operation, operationName)
      : operation;

    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        this.logger.debug('Executing operation', {
          correlationId,
          operationName,
          attempt,
          maxAttempts: this.config.maxAttempts,
          ...context
        });

        const result = await operationWithCircuitBreaker();
        
        if (attempt > 1) {
          this.logger.info('Operation succeeded after retry', {
            correlationId,
            operationName,
            attempt,
            ...context
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        this.logger.warn('Operation failed', {
          correlationId,
          operationName,
          attempt,
          maxAttempts: this.config.maxAttempts,
          error: error.message,
          retryable: isRetryableError(error),
          ...context
        });

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt === this.config.maxAttempts || !isRetryableError(error)) {
          break;
        }

        // Handle rate limit errors specially
        if (error instanceof RateLimitError && error.retryAfter) {
          const delay = error.retryAfter * 1000; // Convert to milliseconds
          this.logger.info('Rate limited, waiting for retry-after', {
            correlationId,
            operationName,
            retryAfter: error.retryAfter,
            delay
          });
          await this.sleep(delay);
          continue;
        }

        // Calculate exponential backoff delay
        const delay = this.calculateDelay(attempt);
        
        this.logger.info('Retrying operation', {
          correlationId,
          operationName,
          attempt,
          delay,
          nextAttempt: attempt + 1
        });

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    this.logger.error('Operation failed after all retries', {
      correlationId,
      operationName,
      maxAttempts: this.config.maxAttempts,
      finalError: lastError.message,
      ...context
    });

    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ (attempt - 1))
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, this.config.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * this.config.jitterFactor * Math.random();
    delay += jitter;
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCircuitBreakerMetrics() {
    return this.circuitBreaker?.getMetrics();
  }
}

// Default configurations
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
  monitoringPeriod: 300000, // 5 minutes
  halfOpenMaxCalls: 3
};

export const CRITICAL_OPERATION_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelay: 500,
  maxDelay: 10000,
  backoffMultiplier: 1.5,
  jitterFactor: 0.2
};

export const CRITICAL_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  monitoringPeriod: 180000, // 3 minutes
  halfOpenMaxCalls: 2
};
