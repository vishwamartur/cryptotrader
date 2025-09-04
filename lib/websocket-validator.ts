/**
 * WebSocket Connection Validator
 * Provides utilities to validate and test WebSocket connections
 */

export interface WebSocketValidationResult {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
}

export interface WebSocketConnectionTest {
  url: string;
  success: boolean;
  error?: string;
  responseTime?: number;
  statusCode?: number;
}

/**
 * Validate WebSocket URL format and accessibility
 */
export function validateWebSocketURL(url: string): WebSocketValidationResult {
  const result: WebSocketValidationResult = { isValid: false };

  // Check if URL is provided
  if (!url || typeof url !== 'string') {
    result.error = 'WebSocket URL is required';
    result.suggestions = ['Provide a valid WebSocket URL starting with ws:// or wss://'];
    return result;
  }

  // Check URL format
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    result.error = 'WebSocket URL must start with ws:// or wss://';
    result.suggestions = [
      'Use wss:// for secure connections (recommended)',
      'Use ws:// only for local development'
    ];
    return result;
  }

  // Validate URL structure
  try {
    const parsedUrl = new URL(url);
    
    // Check for valid hostname
    if (!parsedUrl.hostname || parsedUrl.hostname === 'localhost' && !url.includes('localhost')) {
      result.error = 'Invalid hostname in WebSocket URL';
      result.suggestions = ['Ensure the hostname is valid and accessible'];
      return result;
    }

    // Check for common issues
    if (parsedUrl.hostname.includes('example.com') || parsedUrl.hostname.includes('placeholder')) {
      result.error = 'WebSocket URL appears to be a placeholder';
      result.suggestions = ['Replace with actual WebSocket server URL'];
      return result;
    }

    result.isValid = true;
    return result;

  } catch (error) {
    result.error = `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.suggestions = ['Check URL syntax and format'];
    return result;
  }
}

/**
 * Test WebSocket connection availability
 */
export async function testWebSocketConnection(url: string, timeout: number = 5000): Promise<WebSocketConnectionTest> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const validation = validateWebSocketURL(url);
    
    if (!validation.isValid) {
      resolve({
        url,
        success: false,
        error: validation.error,
        responseTime: Date.now() - startTime
      });
      return;
    }

    const ws = new WebSocket(url);
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          ws.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve({
          url,
          success: false,
          error: 'Connection timeout',
          responseTime: Date.now() - startTime
        });
      }
    }, timeout);

    ws.onopen = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        resolve({
          url,
          success: true,
          responseTime: Date.now() - startTime
        });
      }
    };

    ws.onerror = (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();
        
        let errorMessage = 'Connection failed';
        if (error instanceof ErrorEvent && error.message) {
          errorMessage = error.message;
        }
        
        resolve({
          url,
          success: false,
          error: errorMessage,
          responseTime: Date.now() - startTime
        });
      }
    };

    ws.onclose = (event) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        
        let errorMessage = 'Connection closed';
        if (event.code !== 1000) {
          errorMessage = `Connection closed with code ${event.code}: ${event.reason || 'Unknown reason'}`;
        }
        
        resolve({
          url,
          success: false,
          error: errorMessage,
          responseTime: Date.now() - startTime
        });
      }
    };
  });
}

/**
 * Get WebSocket connection recommendations based on URL
 */
export function getWebSocketRecommendations(url: string): string[] {
  const recommendations: string[] = [];

  if (url.includes('delta.exchange')) {
    recommendations.push(
      'Delta Exchange WebSocket requires authentication',
      'Ensure you have valid API credentials',
      'Check Delta Exchange service status at https://status.delta.exchange',
      'Verify your IP is not blocked by Delta Exchange'
    );
  }

  if (url.startsWith('ws://') && !url.includes('localhost')) {
    recommendations.push(
      'Consider using wss:// for secure connections',
      'Unsecured WebSocket connections may be blocked by browsers'
    );
  }

  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    recommendations.push(
      'Ensure local WebSocket server is running',
      'Check if the port is correct and not blocked by firewall'
    );
  }

  return recommendations;
}

/**
 * Create enhanced error message with troubleshooting steps
 */
export function createWebSocketErrorMessage(url: string, error: string): string {
  const recommendations = getWebSocketRecommendations(url);
  
  let message = `WebSocket connection failed: ${error}\n\nURL: ${url}`;
  
  if (recommendations.length > 0) {
    message += '\n\nTroubleshooting steps:\n';
    recommendations.forEach((rec, index) => {
      message += `${index + 1}. ${rec}\n`;
    });
  }

  return message;
}
