/**
 * WebSocket Security and Rate Limiting
 * Provides security measures for the Delta Exchange WebSocket proxy
 */

import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface ConnectionEntry {
  ip: string;
  userAgent: string;
  connectedAt: number;
  lastActivity: number;
}

class WebSocketSecurity {
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private connectionMap = new Map<string, ConnectionEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxConnections: number;
  private readonly allowedOrigins: string[];

  constructor() {
    this.maxRequests = parseInt(process.env.WEBSOCKET_RATE_LIMIT_REQUESTS || '100');
    this.windowMs = parseInt(process.env.WEBSOCKET_RATE_LIMIT_WINDOW || '60000');
    this.maxConnections = parseInt(process.env.WEBSOCKET_MAX_CONNECTIONS || '50');
    this.allowedOrigins = (process.env.WEBSOCKET_ALLOWED_ORIGINS || 'http://localhost:3000')
      .split(',')
      .map(origin => origin.trim());

    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request is rate limited
   */
  checkRateLimit(clientId: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const entry = this.rateLimitMap.get(clientId);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      this.rateLimitMap.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { allowed: true };
    }

    if (entry.count >= this.maxRequests) {
      return { 
        allowed: false, 
        resetTime: entry.resetTime 
      };
    }

    // Increment counter
    entry.count++;
    return { allowed: true };
  }

  /**
   * Check if origin is allowed
   */
  checkOrigin(origin: string | null): boolean {
    if (!origin) {
      // Allow requests without origin in development (like EventSource from same domain)
      if (process.env.NODE_ENV === 'development') {
        return true;
      }
      return false;
    }

    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    return this.allowedOrigins.includes(origin);
  }

  /**
   * Validate WebSocket/EventSource request
   */
  validateWebSocketRequest(request: NextRequest): {
    valid: boolean;
    error?: string;
    clientId?: string;
  } {
    const clientIp = this.getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const origin = request.headers.get('origin');
    const upgrade = request.headers.get('upgrade');
    const accept = request.headers.get('accept');

    // Check if it's a WebSocket upgrade request OR EventSource request
    const isWebSocket = upgrade?.toLowerCase() === 'websocket';
    const isEventSource = accept?.includes('text/event-stream');

    if (!isWebSocket && !isEventSource) {
      return {
        valid: false,
        error: 'Not a WebSocket upgrade or EventSource request'
      };
    }

    // Check origin
    if (!this.checkOrigin(origin)) {
      return {
        valid: false,
        error: 'Origin not allowed'
      };
    }

    const clientId = this.generateClientId(clientIp, userAgent);

    // Check rate limit
    const rateLimitResult = this.checkRateLimit(clientId);
    if (!rateLimitResult.allowed) {
      return {
        valid: false,
        error: `Rate limit exceeded. Reset at ${new Date(rateLimitResult.resetTime!).toISOString()}`
      };
    }

    // Check connection limit
    if (this.connectionMap.size >= this.maxConnections) {
      return {
        valid: false,
        error: 'Maximum connections reached'
      };
    }

    return {
      valid: true,
      clientId
    };
  }

  /**
   * Register new connection
   */
  registerConnection(clientId: string, request: NextRequest): void {
    const clientIp = this.getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const now = Date.now();

    this.connectionMap.set(clientId, {
      ip: clientIp,
      userAgent,
      connectedAt: now,
      lastActivity: now
    });

    console.log(`[WebSocket Security] Connection registered: ${clientId} from ${clientIp}`);
  }

  /**
   * Update connection activity
   */
  updateActivity(clientId: string): void {
    const connection = this.connectionMap.get(clientId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  /**
   * Unregister connection
   */
  unregisterConnection(clientId: string): void {
    this.connectionMap.delete(clientId);
    console.log(`[WebSocket Security] Connection unregistered: ${clientId}`);
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    activeConnections: number;
    rateLimitEntries: number;
    maxConnections: number;
    maxRequests: number;
    windowMs: number;
  } {
    return {
      activeConnections: this.connectionMap.size,
      rateLimitEntries: this.rateLimitMap.size,
      maxConnections: this.maxConnections,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs
    };
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIp) {
      return realIp;
    }

    // Fallback to connection remote address
    return 'unknown';
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(ip: string, userAgent: string): string {
    const hash = this.simpleHash(ip + userAgent);
    return `client_${hash}_${Date.now()}`;
  }

  /**
   * Simple hash function for client ID generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredConnections: string[] = [];

    // Clean up rate limit entries
    for (const [clientId, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(clientId);
      }
    }

    // Clean up inactive connections (older than 1 hour)
    for (const [clientId, connection] of this.connectionMap.entries()) {
      if (now - connection.lastActivity > 60 * 60 * 1000) {
        expiredConnections.push(clientId);
      }
    }

    expiredConnections.forEach(clientId => {
      this.connectionMap.delete(clientId);
    });

    if (expiredConnections.length > 0) {
      console.log(`[WebSocket Security] Cleaned up ${expiredConnections.length} expired connections`);
    }
  }

  /**
   * Validate API credentials format
   */
  validateCredentials(): { valid: boolean; error?: string } {
    const apiKey = process.env.DELTA_API_KEY;
    const apiSecret = process.env.DELTA_API_SECRET;

    if (!apiKey || !apiSecret) {
      return {
        valid: false,
        error: 'Missing API credentials'
      };
    }

    if (apiKey.length < 10 || apiSecret.length < 20) {
      return {
        valid: false,
        error: 'Invalid API credential format'
      };
    }

    // Check if credentials are still example values
    if (apiKey.includes('your_') || apiSecret.includes('your_')) {
      return {
        valid: false,
        error: 'Please replace example API credentials with real values'
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const webSocketSecurity = new WebSocketSecurity();

// Export types
export type { RateLimitEntry, ConnectionEntry };
