/**
 * Enhanced API Client with Trading Best Practices
 * Integrates error handling, rate limiting, retry logic, and comprehensive logging
 */

import { Logger, getLogger } from './logger';
import { RateLimiter, RequestPriority, DELTA_EXCHANGE_RATE_LIMITS } from './rate-limiter';
import { RetryHandler, DEFAULT_RETRY_CONFIG, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './retry-handler';
import { 
  TradingError, 
  APIError, 
  NetworkError, 
  RateLimitError, 
  AuthenticationError,
  createErrorFromResponse,
  generateCorrelationId 
} from './errors';

export interface APIClientConfig {
  baseURL: string;
  apiKey?: string;
  apiSecret?: string;
  timeout: number;
  retryConfig?: any;
  rateLimitConfig?: any;
  circuitBreakerConfig?: any;
  enableMetrics: boolean;
}

export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  priority?: RequestPriority;
  timeout?: number;
  skipRateLimit?: boolean;
  skipRetry?: boolean;
}

export interface APIResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  duration: number;
  cached: boolean;
  correlationId: string;
}

export class EnhancedAPIClient {
  private readonly config: APIClientConfig;
  private readonly logger: Logger;
  private readonly rateLimiter: RateLimiter;
  private readonly retryHandler: RetryHandler;
  private readonly cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  constructor(config: APIClientConfig) {
    this.config = {
      timeout: 30000,
      enableMetrics: true,
      ...config
    };

    this.logger = getLogger();
    this.rateLimiter = new RateLimiter(
      config.rateLimitConfig || DELTA_EXCHANGE_RATE_LIMITS,
      this.logger
    );
    this.retryHandler = new RetryHandler(
      config.retryConfig || DEFAULT_RETRY_CONFIG,
      this.logger,
      config.circuitBreakerConfig || DEFAULT_CIRCUIT_BREAKER_CONFIG
    );
  }

  async request<T = any>(request: APIRequest): Promise<APIResponse<T>> {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();
    
    this.logger.info('API request initiated', {
      correlationId,
      method: request.method,
      endpoint: request.endpoint,
      priority: RequestPriority[request.priority || RequestPriority.NORMAL]
    });

    try {
      // Check cache first for GET requests
      if (request.method === 'GET') {
        const cached = this.getFromCache(request.endpoint, request.params);
        if (cached) {
          this.logger.debug('Cache hit', { correlationId, endpoint: request.endpoint });
          return {
            data: cached.data,
            status: 200,
            headers: {},
            duration: Date.now() - startTime,
            cached: true,
            correlationId
          };
        }
      }

      const executeRequest = async () => {
        return await this.executeHTTPRequest<T>(request, correlationId);
      };

      let response: APIResponse<T>;

      if (request.skipRateLimit) {
        if (request.skipRetry) {
          response = await executeRequest();
        } else {
          response = await this.retryHandler.execute(
            executeRequest,
            `${request.method} ${request.endpoint}`,
            { correlationId, endpoint: request.endpoint }
          );
        }
      } else {
        const rateLimitedRequest = async () => {
          if (request.skipRetry) {
            return await executeRequest();
          } else {
            return await this.retryHandler.execute(
              executeRequest,
              `${request.method} ${request.endpoint}`,
              { correlationId, endpoint: request.endpoint }
            );
          }
        };

        response = await this.rateLimiter.execute(
          rateLimitedRequest,
          `${request.method} ${request.endpoint}`,
          request.priority || RequestPriority.NORMAL,
          { correlationId, endpoint: request.endpoint }
        );
      }

      // Cache successful GET responses
      if (request.method === 'GET' && response.status === 200) {
        this.setCache(request.endpoint, request.params, response.data, 60000); // 1 minute default TTL
      }

      this.logger.info('API request completed', {
        correlationId,
        method: request.method,
        endpoint: request.endpoint,
        status: response.status,
        duration: response.duration,
        cached: response.cached
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('API request failed', {
        correlationId,
        method: request.method,
        endpoint: request.endpoint,
        duration,
        error: (error as Error).message
      }, error as Error);

      throw error;
    }
  }

  private async executeHTTPRequest<T>(request: APIRequest, correlationId: string): Promise<APIResponse<T>> {
    const url = this.buildURL(request.endpoint, request.params);
    const headers = this.buildHeaders(request.headers);
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, request.timeout || this.config.timeout);

    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        signal: controller.signal
      };

      if (request.data && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
        fetchOptions.body = JSON.stringify(request.data);
      }

      this.logger.debug('HTTP request details', {
        correlationId,
        url,
        method: request.method,
        headers: this.sanitizeHeaders(headers),
        hasBody: !!request.data
      });

      const response = await fetch(url, fetchOptions);
      const duration = Date.now() - startTime;

      clearTimeout(timeoutId);

      // Log API call metrics
      this.logger.logAPICall(
        request.method,
        request.endpoint,
        response.status,
        duration,
        { correlationId }
      );

      if (!response.ok) {
        throw createErrorFromResponse(response, {
          correlationId,
          operation: `${request.method} ${request.endpoint}`,
          requestDetails: { url, method: request.method }
        });
      }

      let data: T;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text() as any;
      }

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        data,
        status: response.status,
        headers: responseHeaders,
        duration,
        cached: false,
        correlationId
      };

    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error instanceof TradingError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout', {
          correlationId,
          operation: `${request.method} ${request.endpoint}`,
          timeout: request.timeout || this.config.timeout
        });
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new NetworkError(`Network error: ${error.message}`, {
          correlationId,
          operation: `${request.method} ${request.endpoint}`,
          networkError: error.code
        });
      }

      throw new APIError(`Request failed: ${error.message}`, 0, {
        correlationId,
        operation: `${request.method} ${request.endpoint}`,
        originalError: error.message
      });
    }
  }

  private buildURL(endpoint: string, params?: Record<string, any>): string {
    let url = `${this.config.baseURL}${endpoint}`;
    
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      url += `?${searchParams.toString()}`;
    }
    
    return url;
  }

  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CryptoTrader/1.0',
      ...customHeaders
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    if (sanitized['Authorization']) {
      sanitized['Authorization'] = 'Bearer [REDACTED]';
    }
    return sanitized;
  }

  private getCacheKey(endpoint: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramString}`;
  }

  private getFromCache(endpoint: string, params?: Record<string, any>): { data: any } | null {
    const key = this.getCacheKey(endpoint, params);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return { data: cached.data };
  }

  private setCache(endpoint: string, params: Record<string, any> | undefined, data: any, ttl: number): void {
    const key = this.getCacheKey(endpoint, params);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Public utility methods
  clearCache(): void {
    this.cache.clear();
    this.logger.info('API cache cleared');
  }

  getMetrics() {
    return {
      rateLimiter: this.rateLimiter.getState(),
      queue: this.rateLimiter.getQueueInfo(),
      circuitBreaker: this.retryHandler.getCircuitBreakerMetrics(),
      cacheSize: this.cache.size
    };
  }

  destroy(): void {
    this.rateLimiter.stop();
    this.clearCache();
    this.logger.info('API client destroyed');
  }
}
