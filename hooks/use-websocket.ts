"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { generateHmacSha256 } from "../lib/crypto-utils"
import { validateWebSocketURL, createWebSocketErrorMessage } from "../lib/websocket-validator"

// WebSocket diagnostic helper
function diagnoseWebSocketError(url: string, errorDetails: any): string[] {
  const diagnostics: string[] = [];

  if (url.includes('delta.exchange')) {
    diagnostics.push('🔍 Delta Exchange WebSocket Diagnostics:');
    diagnostics.push('• Check if Delta Exchange WebSocket service is operational');
    diagnostics.push('• Verify your API credentials are valid');
    diagnostics.push('• Ensure your IP is not blocked by Delta Exchange');
    diagnostics.push('• Check Delta Exchange status: https://status.delta.exchange');
  }

  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    diagnostics.push('🔍 Local WebSocket Diagnostics:');
    diagnostics.push('• Verify local WebSocket server is running');
    diagnostics.push('• Check if the port is correct and not blocked');
    diagnostics.push('• Ensure no other service is using the same port');
  }

  if (errorDetails.target?.readyState === WebSocket.CONNECTING) {
    diagnostics.push('🔍 Connection Diagnostics:');
    diagnostics.push('• Server may be unreachable or overloaded');
    diagnostics.push('• Check your internet connection');
    diagnostics.push('• Verify firewall is not blocking WebSocket connections');
    diagnostics.push('• Try connecting to the server from a different network');
  }

  if (errorDetails.connectionContext?.reconnectAttempts > 0) {
    diagnostics.push('🔍 Reconnection Diagnostics:');
    diagnostics.push(`• This is reconnection attempt ${errorDetails.connectionContext.reconnectAttempts + 1}`);
    diagnostics.push('• Previous connections have failed');
    diagnostics.push('• Consider checking server logs for connection issues');
  }

  return diagnostics;
}

interface WebSocketConfig {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

interface AuthMessage {
  type: "auth"
  api_key: string
  signature: string
  timestamp: string
}

interface SubscribeMessage {
  type: "subscribe"
  payload: {
    channels: Array<{
      name: string
      symbols: string[]
    }>
  }
}

export function useWebSocket(config: WebSocketConfig) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const messageHandlersRef = useRef<Map<string, (data: any) => void>>(new Map())

  const { url, reconnectInterval = 5000, maxReconnectAttempts = 10 } = config

  const connect = useCallback(() => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      // Validate WebSocket URL
      const validation = validateWebSocketURL(url);
      if (!validation.isValid) {
        const errorMsg = createWebSocketErrorMessage(url, validation.error || 'Invalid URL');
        console.error("[v0] WebSocket URL validation failed:", validation);
        setError(errorMsg);
        return;
      }

      console.log("[v0] Attempting to connect to WebSocket:", url);
      console.log("[v0] Connection attempt #", reconnectAttempts + 1);

      const ws = new WebSocket(url);
      wsRef.current = ws;

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.error("[v0] WebSocket connection timeout");
          ws.close();
          setError("Connection timeout - WebSocket server did not respond");
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("[v0] ✅ WebSocket connected successfully");
        console.log("[v0] Connection details:", {
          url: url,
          protocol: ws.protocol || 'none',
          extensions: ws.extensions || 'none',
          readyState: ws.readyState,
          readyStateName: 'OPEN'
        });
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log("[v0] WebSocket message received:", data)
          const channel = data.type || data.channel

          if (channel && messageHandlersRef.current.has(channel)) {
            const handler = messageHandlersRef.current.get(channel)
            handler?.(data)
          }
        } catch (err) {
          console.error("[v0] Error parsing WebSocket message:", err, "Raw data:", event.data)
        }
      }

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);

        const closeDetails = {
          code: event.code,
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean,
          url: url,
          timestamp: new Date().toISOString()
        };

        // Determine close reason category
        let closeCategory = 'Unknown';
        if (event.code === 1000) closeCategory = 'Normal closure';
        else if (event.code === 1001) closeCategory = 'Going away';
        else if (event.code === 1002) closeCategory = 'Protocol error';
        else if (event.code === 1003) closeCategory = 'Unsupported data';
        else if (event.code === 1006) closeCategory = 'Abnormal closure';
        else if (event.code === 1011) closeCategory = 'Server error';
        else if (event.code === 1012) closeCategory = 'Service restart';
        else if (event.code === 1013) closeCategory = 'Try again later';
        else if (event.code === 1014) closeCategory = 'Bad gateway';
        else if (event.code === 1015) closeCategory = 'TLS handshake failure';

        console.log("[v0] 🔌 WebSocket disconnected:", closeCategory);
        console.log("[v0] Close details:", closeDetails);

        setIsConnected(false);

        let errorMessage = "Connection closed"
        switch (event.code) {
          case 1000:
            errorMessage = "Connection closed normally"
            break
          case 1001:
            errorMessage = "Connection closed - going away"
            break
          case 1002:
            errorMessage = "Connection closed - protocol error"
            break
          case 1003:
            errorMessage = "Connection closed - unsupported data"
            break
          case 1006:
            errorMessage = "Connection closed abnormally"
            break
          case 1011:
            errorMessage = "Connection closed - server error"
            break
          case 1012:
            errorMessage = "Connection closed - service restart"
            break
          default:
            errorMessage = `Connection closed - Code: ${event.code}`
        }

        if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
          console.log("[v0] Attempting to reconnect in", reconnectInterval, "ms")
          reconnectTimeoutRef.current = window.setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1)
            connect()
          }, reconnectInterval)
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          setError("Max reconnection attempts reached")
        }
      }

      ws.onerror = (errorEvent) => {
        // Extract meaningful error information with proper error handling
        let errorDetails: any = {};

        try {
          // Safely extract event properties
          errorDetails.eventType = errorEvent.type || 'error';
          errorDetails.timeStamp = errorEvent.timeStamp || Date.now();

          // Check if it's an ErrorEvent (has message property)
          if (errorEvent instanceof ErrorEvent) {
            errorDetails.isErrorEvent = true;
            errorDetails.message = errorEvent.message || 'No error message';
            errorDetails.filename = errorEvent.filename || 'Unknown file';
            errorDetails.lineno = errorEvent.lineno || 0;
            errorDetails.colno = errorEvent.colno || 0;
          } else {
            errorDetails.isErrorEvent = false;
            errorDetails.message = 'WebSocket error (no message available)';
          }

          // Extract WebSocket target information
          if (errorEvent.target && errorEvent.target instanceof WebSocket) {
            const wsTarget = errorEvent.target as WebSocket;
            errorDetails.target = {
              readyState: wsTarget.readyState,
              readyStateName: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsTarget.readyState] || 'UNKNOWN',
              url: wsTarget.url || url,
              protocol: wsTarget.protocol || 'unknown',
              extensions: wsTarget.extensions || 'none'
            };
          } else {
            errorDetails.target = {
              readyState: 'unknown',
              readyStateName: 'UNKNOWN',
              url: url,
              protocol: 'unknown',
              extensions: 'none'
            };
          }

          // Add connection context
          errorDetails.connectionContext = {
            url: url,
            reconnectAttempts: reconnectAttempts,
            maxReconnectAttempts: maxReconnectAttempts,
            isConnected: isConnected
          };

        } catch (extractError) {
          console.warn("[v0] Error extracting WebSocket error details:", extractError);
          errorDetails = {
            eventType: 'error',
            message: 'Failed to extract error details',
            extractionError: extractError instanceof Error ? extractError.message : 'Unknown extraction error',
            url: url,
            reconnectAttempts: reconnectAttempts
          };
        }

        console.error("[v0] WebSocket error event details:", errorDetails);

        // Generate detailed error message based on extracted details
        let errorMessage = "WebSocket connection error";

        if (errorDetails.isErrorEvent && errorDetails.message && errorDetails.message !== 'No error message') {
          errorMessage = `WebSocket error: ${errorDetails.message}`;
        } else if (errorDetails.target && errorDetails.target.readyState !== 'unknown') {
          const readyState = errorDetails.target.readyState;
          const readyStateName = errorDetails.target.readyStateName;
          const wsUrl = errorDetails.target.url;

          switch (readyState) {
            case WebSocket.CONNECTING:
              errorMessage = `Failed to connect to WebSocket server (${wsUrl})`;
              break;
            case WebSocket.CLOSING:
              errorMessage = "WebSocket connection is closing";
              break;
            case WebSocket.CLOSED:
              errorMessage = `WebSocket connection closed unexpectedly (${wsUrl})`;
              break;
            case WebSocket.OPEN:
              errorMessage = `WebSocket error while connected (${wsUrl})`;
              break;
            default:
              errorMessage = `WebSocket error in state: ${readyStateName} (${readyState})`;
          }
        } else {
          errorMessage = `WebSocket connection error for ${url}`;
        }

        // Add connection context to error message
        if (reconnectAttempts > 0) {
          errorMessage += ` (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`;
        }

        // Create enhanced error message with troubleshooting steps
        const enhancedErrorMessage = createWebSocketErrorMessage(url, errorMessage);

        // Add diagnostic information
        const diagnostics = diagnoseWebSocketError(url, errorDetails);
        if (diagnostics.length > 0) {
          console.warn("[v0] WebSocket Connection Diagnostics:");
          diagnostics.forEach(diagnostic => console.warn(diagnostic));
        }

        console.error("[v0] Enhanced error message:", enhancedErrorMessage);
        setError(enhancedErrorMessage);
      }
    } catch (err) {
      console.error("[v0] Error creating WebSocket connection:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      const fullError = `Failed to create WebSocket connection to ${url}: ${errorMessage}`;
      console.error("[v0]", fullError);
      setError(fullError);
    }
  }, [url, reconnectInterval, maxReconnectAttempts, reconnectAttempts])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn("WebSocket not connected, cannot send message")
    }
  }, [])

  const authenticate = useCallback(
    async (apiKey: string, apiSecret: string) => {
      try {
        const timestamp = Math.floor(Date.now() / 1000).toString()
        const message = "GET" + timestamp + "/live"
        const signature = await generateHmacSha256(message, apiSecret)

        const authMessage: AuthMessage = {
          type: "auth",
          api_key: apiKey,
          signature,
          timestamp,
        }

        console.log("[v0] Sending authentication message")
        sendMessage(authMessage)
      } catch (err) {
        console.error("[v0] Error during authentication:", err)
        setError(`Authentication failed: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
    },
    [sendMessage],
  )

  const subscribe = useCallback(
    (channels: Array<{ name: string; symbols: string[] }>) => {
      const subscribeMessage: SubscribeMessage = {
        type: "subscribe",
        payload: { channels },
      }
      sendMessage(subscribeMessage)
    },
    [sendMessage],
  )

  const unsubscribe = useCallback(
    (channels: Array<{ name: string; symbols: string[] }>) => {
      const unsubscribeMessage = {
        type: "unsubscribe",
        payload: { channels },
      }
      sendMessage(unsubscribeMessage)
    },
    [sendMessage],
  )

  const addMessageHandler = useCallback((channel: string, handler: (data: any) => void) => {
    messageHandlersRef.current.set(channel, handler)
  }, [])

  const removeMessageHandler = useCallback((channel: string) => {
    messageHandlersRef.current.delete(channel)
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    error,
    reconnectAttempts,
    sendMessage,
    authenticate,
    subscribe,
    unsubscribe,
    addMessageHandler,
    removeMessageHandler,
    connect,
    disconnect,
  }
}
