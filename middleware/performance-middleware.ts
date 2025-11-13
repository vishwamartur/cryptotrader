// API Performance Middleware
// Implements rate limiting, caching, request optimization, and monitoring
// Optimized for <100ms response time for 95% of API requests

import { Request, Response, NextFunction } from 'express'
import { createHash } from 'crypto'
import { performance } from 'perf_hooks'
import NodeCache from 'node-cache'
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'

export interface PerformanceConfig {
  // Rate limiting
  userRateLimit: number      // requests per minute per user
  ipRateLimit: number         // requests per minute per IP
  premiumRateLimit: number   // requests per minute for premium users

  // Caching
  cacheEnabled: boolean
  defaultCacheTTL: number    // seconds
  maxCacheSize: number
  enableCompression: boolean

  // Request optimization
  maxRequestSize: number     // bytes
  requestTimeout: number     // milliseconds
  enableRequestDeduplication: boolean

  // Monitoring
  enableMetrics: boolean
  slowRequestThreshold: number // milliseconds
}

export interface RequestMetrics {
  method: string
  path: string
  statusCode: number
  responseTime: number
  userAgent: string
  ip: string
  userId?: string
  timestamp: number
  fromCache: boolean
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

export interface CacheOptions {
  ttl?: number
  key?: string
  skipCache?: boolean
  varyOn?: string[]
}

interface CacheEntry {
  data: any
  statusCode: number
  headers: Record<string, string>
  timestamp: number
  ttl: number
  compressed?: boolean
}

class PerformanceCache {
  private cache: NodeCache
  private redisCache?: Redis

  constructor(config: PerformanceConfig) {
    // In-memory cache for fast access
    this.cache = new NodeCache({
      maxKeys: config.maxCacheSize,
      stdTTL: config.defaultCacheTTL,
      checkperiod: 30,
      useClones: false
    })

    // Redis cache for distributed environments
    if (process.env.REDIS_URL) {
      this.redisCache = new Redis(process.env.REDIS_URL)
    }
  }

  async get(key: string): Promise<CacheEntry | null> {
    // Try in-memory cache first
    const cached = this.cache.get<CacheEntry>(key)
    if (cached) {
      return cached
    }

    // Try Redis cache
    if (this.redisCache) {
      try {
        const redisCached = await this.redisCache.get(key)
        if (redisCached) {
          const parsed = JSON.parse(redisCached as string)
          // Promote to in-memory cache
          this.cache.set(key, parsed, parsed.ttl)
          return parsed
        }
      } catch (error) {
        console.error('Redis cache error:', error)
      }
    }

    return null
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Set in-memory cache
    this.cache.set(key, entry, entry.ttl)

    // Set in Redis cache
    if (this.redisCache) {
      try {
        await this.redisCache.setex(key, entry.ttl, JSON.stringify(entry))
      } catch (error) {
        console.error('Redis cache set error:', error)
      }
    }
  }

  async del(key: string): Promise<void> {
    this.cache.del(key)
    if (this.redisCache) {
      try {
        await this.redisCache.del(key)
      } catch (error) {
        console.error('Redis cache delete error:', error)
      }
    }
  }

  getStats(): {
    memoryKeys: number
    memorySize: number
    redisConnected: boolean
  } {
    return {
      memoryKeys: this.cache.keys().length,
      memorySize: this.cache.getStats().ksize,
      redisConnected: this.redisCache?.status === 'ready' || false
    }
  }

  clear(): void {
    this.cache.flushAll()
  }
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, Array<{
    resolve: (value: any) => void
    reject: (error: any) => void
  }>>()

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // If request is already pending, wait for it
    if (this.pendingRequests.has(key)) {
      const pending = this.pendingRequests.get(key)!
      return new Promise<T>((resolve, reject) => {
        pending.push({ resolve, reject })
      })
    }

    // Start new request
    this.pendingRequests.set(key, [])

    try {
      const result = await requestFn()

      // Resolve all pending requests
      const pending = this.pendingRequests.get(key)!
      pending.forEach(({ resolve }) => resolve(result))
      this.pendingRequests.delete(key)

      return result
    } catch (error) {
      // Reject all pending requests
      const pending = this.pendingRequests.get(key)!
      pending.forEach(({ reject }) => reject(error))
      this.pendingRequests.delete(key)

      throw error
    }
  }

  clear(): void {
    this.pendingRequests.clear()
  }
}

class RequestMetricsCollector {
  private metrics: RequestMetrics[] = []
  private maxMetrics = 10000

  addMetric(metric: RequestMetrics): void {
    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  getMetrics(timeWindow?: number): RequestMetrics[] {
    if (!timeWindow) {
      return [...this.metrics]
    }

    const cutoff = Date.now() - timeWindow
    return this.metrics.filter(metric => metric.timestamp > cutoff)
  }

  getStats(timeWindow: number = 5 * 60 * 1000): {
    totalRequests: number
    averageResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    slowRequests: number
    errorRate: number
    cacheHitRate: number
    topEndpoints: Array<{ path: string; count: number; avgTime: number }>
  } {
    const recentMetrics = this.getMetrics(timeWindow)

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowRequests: 0,
        errorRate: 0,
        cacheHitRate: 0,
        topEndpoints: []
      }
    }

    const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b)
    const slowRequests = recentMetrics.filter(m => m.responseTime > 1000).length
    const errorRequests = recentMetrics.filter(m => m.statusCode >= 400).length
    const cacheHits = recentMetrics.filter(m => m.fromCache).length

    // Calculate top endpoints
    const endpointStats = new Map<string, { count: number; totalTime: number }>()
    recentMetrics.forEach(metric => {
      const existing = endpointStats.get(metric.path) || { count: 0, totalTime: 0 }
      endpointStats.set(metric.path, {
        count: existing.count + 1,
        totalTime: existing.totalTime + metric.responseTime
      })
    })

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        avgTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalRequests: recentMetrics.length,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)] || 0,
      p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)] || 0,
      slowRequests,
      errorRate: errorRequests / recentMetrics.length,
      cacheHitRate: cacheHits / recentMetrics.length,
      topEndpoints
    }
  }

  clear(): void {
    this.metrics = []
  }
}

export class PerformanceMiddleware {
  private config: PerformanceConfig
  private cache: PerformanceCache
  private deduplicator: RequestDeduplicator
  private metrics: RequestMetricsCollector

  // Rate limiters
  private userRateLimiter: any
  private ipRateLimiter: any
  private premiumRateLimiter: any

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      userRateLimit: 100,        // 100 requests/min per user
      ipRateLimit: 20,           // 20 requests/min per IP
      premiumRateLimit: 500,     // 500 requests/min for premium users
      cacheEnabled: true,
      defaultCacheTTL: 300,      // 5 minutes
      maxCacheSize: 10000,
      enableCompression: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      requestTimeout: 30000,     // 30 seconds
      enableRequestDeduplication: true,
      enableMetrics: true,
      slowRequestThreshold: 1000, // 1 second
      ...config
    }

    this.cache = new PerformanceCache(this.config)
    this.deduplicator = new RequestDeduplicator()
    this.metrics = new RequestMetricsCollector()

    this.setupRateLimiters()
  }

  private setupRateLimiters(): void {
    // User-based rate limiting (requires authentication)
    this.userRateLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: this.config.userRateLimit,
      message: 'Too many requests from this user',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        const userId = this.extractUserId(req)
        return userId ? `user:${userId}` : req.ip
      },
      store: process.env.REDIS_URL ? new RedisStore({
        sendCommand: (...args: string[]) => this.cache['redisCache']?.call(...args)
      }) : undefined
    })

    // IP-based rate limiting for anonymous users
    this.ipRateLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: this.config.ipRateLimit,
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => req.ip,
      skip: (req: Request) => this.extractUserId(req) !== undefined
    })

    // Premium user rate limiting
    this.premiumRateLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: this.config.premiumRateLimit,
      message: 'Too many requests',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        const userId = this.extractUserId(req)
        return this.isPremiumUser(req) ? `premium:${userId}` : null
      },
      skip: (req: Request) => !this.isPremiumUser(req)
    })
  }

  private extractUserId(req: Request): string | undefined {
    return req.user?.id || req.headers['x-user-id'] as string
  }

  private isPremiumUser(req: Request): boolean {
    const user = req.user as any
    return user?.isPremium || user?.subscription?.tier === 'premium'
  }

  private generateCacheKey(req: Request, options: CacheOptions): string {
    const key = options.key || createHash('sha256')
      .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`)
      .digest('hex')

    // Add user context if user-specific
    const userId = this.extractUserId(req)
    return userId ? `${key}:user:${userId}` : key
  }

  private shouldSkipCache(req: Request): boolean {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') return true

    // Skip caching for authenticated requests unless explicitly configured
    if (this.extractUserId(req) && !req.headers['x-cache-user']) return true

    // Skip caching for requests with Authorization header
    if (req.headers.authorization) return true

    return false
  }

  private isSlowRequest(responseTime: number): boolean {
    return responseTime > this.config.slowRequestThreshold
  }

  // Middleware function
  middleware(options: CacheOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = performance.now()
      let fromCache = false

      try {
        // Apply rate limiting
        if (!this.skipRateLimit(req)) {
          await this.applyRateLimiting(req, res)
        }

        // Check cache
        if (this.config.cacheEnabled && !this.shouldSkipCache(req) && !options.skipCache) {
          const cacheKey = this.generateCacheKey(req, options)
          const cached = await this.cache.get(cacheKey)

          if (cached) {
            fromCache = true
            this.sendCachedResponse(res, cached)
            this.recordMetrics(req, res, startTime, fromCache)
            return
          }

          // Cache miss - wrap response to cache it
          this.wrapResponseForCaching(req, res, cacheKey, options.ttl || this.config.defaultCacheTTL)
        }

        // Request deduplication for identical requests
        if (this.config.enableRequestDeduplication) {
          const deduplicationKey = `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`
          const userId = this.extractUserId(req)
          const key = userId ? `${deduplicationKey}:${userId}` : deduplicationKey

          const deduplicatedResponse = await this.deduplicator.deduplicate(key, async () => {
            return new Promise((resolve, reject) => {
              // Override res.send to capture response
              const originalSend = res.send
              res.send = (data: any) => {
                originalSend.call(res, data)
                resolve({ data, statusCode: res.statusCode, headers: res.getHeaders() })
              }

              // Continue to next middleware
              next()
            })
          })

          if (deduplicatedResponse) {
            this.sendDeduplicatedResponse(res, deduplicatedResponse)
            this.recordMetrics(req, res, startTime, fromCache)
            return
          }
        }

        // Continue to next middleware
        const originalSend = res.send
        res.send = (data: any) => {
          originalSend.call(res, data)
          this.recordMetrics(req, res, startTime, fromCache)
        }

        next()

      } catch (error) {
        console.error('Performance middleware error:', error)
        this.recordMetrics(req, res, startTime, fromCache)
        next(error)
      }
    }
  }

  private skipRateLimit(req: Request): boolean {
    // Skip rate limiting for health checks and internal routes
    const skipPaths = ['/health', '/metrics', '/internal']
    return skipPaths.some(path => req.path.startsWith(path))
  }

  private async applyRateLimiting(req: Request, res: Response): Promise<void> {
    // Apply appropriate rate limiter
    const userId = this.extractUserId(req)
    const isPremium = this.isPremiumUser(req)

    if (userId && isPremium) {
      await this.premiumRateLimiter(req, res, () => {})
    } else if (userId) {
      await this.userRateLimiter(req, res, () => {})
    } else {
      await this.ipRateLimiter(req, res, () => {})
    }
  }

  private wrapResponseForCaching(req: Request, res: Response, cacheKey: string, ttl: number): void {
    const originalSend = res.send
    const originalJson = res.json

    res.send = (data: any) => {
      // Cache the response
      const cacheEntry: CacheEntry = {
        data,
        statusCode: res.statusCode,
        headers: res.getHeaders() as Record<string, string>,
        timestamp: Date.now(),
        ttl
      }

      this.cache.set(cacheKey, cacheEntry)
      originalSend.call(res, data)
    }

    res.json = (data: any) => {
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify(data))
    }
  }

  private sendCachedResponse(res: Response, cached: CacheEntry): void {
    // Restore cached headers
    Object.entries(cached.headers).forEach(([key, value]) => {
      if (value) {
        res.setHeader(key, value)
      }
    })

    res.status(cached.statusCode)
    res.send(cached.data)
  }

  private sendDeduplicatedResponse(res: Response, response: any): void {
    Object.entries(response.headers).forEach(([key, value]) => {
      if (value) {
        res.setHeader(key, value)
      }
    })

    res.status(response.statusCode)
    res.send(response.data)
  }

  private recordMetrics(req: Request, res: Response, startTime: number, fromCache: boolean): void {
    if (!this.config.enableMetrics) return

    const responseTime = performance.now() - startTime
    const metric: RequestMetrics = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip,
      userId: this.extractUserId(req),
      timestamp: Date.now(),
      fromCache
    }

    this.metrics.addMetric(metric)

    // Log slow requests
    if (this.isSlowRequest(responseTime)) {
      console.warn(`Slow request detected: ${req.method} ${req.path} - ${responseTime.toFixed(2)}ms`, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        statusCode: res.statusCode
      })
    }
  }

  // Cache management methods
  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      // Clear cache entries matching pattern
      // Implementation depends on cache store
      this.cache.clear()
    } else {
      this.cache.clear()
    }
  }

  getCacheStats(): any {
    return this.cache.getStats()
  }

  // Metrics methods
  getMetrics(timeWindow?: number): RequestMetrics[] {
    return this.metrics.getMetrics(timeWindow)
  }

  getPerformanceStats(timeWindow: number = 5 * 60 * 1000): any {
    return this.metrics.getStats(timeWindow)
  }

  clearMetrics(): void {
    this.metrics.clear()
  }

  // Cleanup
  cleanup(): void {
    this.cache.clear()
    this.deduplicator.clear()
    this.metrics.clear()
  }
}

// Create default instance
const defaultPerformanceMiddleware = new PerformanceMiddleware()

export default defaultPerformanceMiddleware
export { PerformanceMiddleware, RequestMetrics, RateLimitInfo, CacheOptions }