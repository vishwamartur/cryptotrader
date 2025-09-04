/**
 * WebSocket Configuration Helper
 * Manages WebSocket URLs and connection settings
 */

export interface WebSocketEndpoint {
  name: string;
  url: string;
  description: string;
  requiresAuth: boolean;
  isDefault?: boolean;
}

export interface WebSocketConfig {
  endpoint: WebSocketEndpoint;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  connectionTimeout: number;
  heartbeatInterval?: number;
}

/**
 * Available WebSocket endpoints
 */
export const WEBSOCKET_ENDPOINTS: WebSocketEndpoint[] = [
  {
    name: 'delta-exchange',
    url: 'wss://socket.india.delta.exchange',
    description: 'Delta Exchange WebSocket API',
    requiresAuth: true,
    isDefault: true
  },
  {
    name: 'local-development',
    url: 'ws://localhost:3001',
    description: 'Local development WebSocket server',
    requiresAuth: false
  },
  {
    name: 'custom',
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    description: 'Custom WebSocket endpoint from environment',
    requiresAuth: false
  }
];

/**
 * Get WebSocket endpoint by name
 */
export function getWebSocketEndpoint(name: string): WebSocketEndpoint | null {
  return WEBSOCKET_ENDPOINTS.find(endpoint => endpoint.name === name) || null;
}

/**
 * Get default WebSocket endpoint
 */
export function getDefaultWebSocketEndpoint(): WebSocketEndpoint {
  return WEBSOCKET_ENDPOINTS.find(endpoint => endpoint.isDefault) || WEBSOCKET_ENDPOINTS[0];
}

/**
 * Get WebSocket URL from environment or default
 */
export function getWebSocketURL(): string {
  // Check for environment variable first
  const envUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_DELTA_WS_URL;
  if (envUrl) {
    return envUrl;
  }

  // Fall back to default endpoint
  return getDefaultWebSocketEndpoint().url;
}

/**
 * Create WebSocket configuration
 */
export function createWebSocketConfig(options: {
  endpointName?: string;
  customUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  connectionTimeout?: number;
  heartbeatInterval?: number;
} = {}): WebSocketConfig {
  let endpoint: WebSocketEndpoint;

  if (options.customUrl) {
    endpoint = {
      name: 'custom',
      url: options.customUrl,
      description: 'Custom WebSocket endpoint',
      requiresAuth: false
    };
  } else if (options.endpointName) {
    endpoint = getWebSocketEndpoint(options.endpointName) || getDefaultWebSocketEndpoint();
  } else {
    endpoint = getDefaultWebSocketEndpoint();
  }

  return {
    endpoint,
    reconnectInterval: options.reconnectInterval || 5000,
    maxReconnectAttempts: options.maxReconnectAttempts || 10,
    connectionTimeout: options.connectionTimeout || 10000,
    heartbeatInterval: options.heartbeatInterval
  };
}

/**
 * Get WebSocket configuration for Delta Exchange
 */
export function getDeltaExchangeWebSocketConfig(): WebSocketConfig {
  return createWebSocketConfig({
    endpointName: 'delta-exchange',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    connectionTimeout: 10000,
    heartbeatInterval: 30000
  });
}

/**
 * Get WebSocket configuration for local development
 */
export function getLocalWebSocketConfig(): WebSocketConfig {
  return createWebSocketConfig({
    endpointName: 'local-development',
    reconnectInterval: 2000,
    maxReconnectAttempts: 5,
    connectionTimeout: 5000
  });
}

/**
 * Validate WebSocket configuration
 */
export function validateWebSocketConfig(config: WebSocketConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.endpoint.url) {
    errors.push('WebSocket URL is required');
  }

  if (!config.endpoint.url.startsWith('ws://') && !config.endpoint.url.startsWith('wss://')) {
    errors.push('WebSocket URL must start with ws:// or wss://');
  }

  if (config.reconnectInterval < 1000) {
    errors.push('Reconnect interval should be at least 1000ms');
  }

  if (config.maxReconnectAttempts < 1) {
    errors.push('Max reconnect attempts should be at least 1');
  }

  if (config.connectionTimeout < 1000) {
    errors.push('Connection timeout should be at least 1000ms');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get environment-specific WebSocket configuration
 */
export function getEnvironmentWebSocketConfig(): WebSocketConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isDevelopment) {
    // In development, prefer local server if available, otherwise use Delta Exchange
    const localUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (localUrl && localUrl.includes('localhost')) {
      return getLocalWebSocketConfig();
    }
  }

  // Default to Delta Exchange for production or when no local server
  return getDeltaExchangeWebSocketConfig();
}

/**
 * Create WebSocket URL with authentication parameters (if needed)
 */
export function createAuthenticatedWebSocketURL(baseUrl: string, apiKey?: string): string {
  if (!apiKey) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('api_key', apiKey);
    return url.toString();
  } catch (error) {
    console.warn('Failed to add authentication to WebSocket URL:', error);
    return baseUrl;
  }
}
