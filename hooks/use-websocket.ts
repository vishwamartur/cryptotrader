"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { generateHmacSha256 } from "../lib/crypto-utils"
import { validateWebSocketURL, createWebSocketErrorMessage } from "../lib/websocket-validator"

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
        console.log("[v0] WebSocket connected successfully to:", url);
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
        console.log(
          "[v0] WebSocket disconnected - Code:",
          event.code,
          "Reason:",
          event.reason || 'No reason provided',
          "Clean:",
          event.wasClean,
          "URL:",
          url
        );
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
        // Extract meaningful error information
        const errorDetails = {
          type: errorEvent.type,
          timeStamp: errorEvent.timeStamp,
          target: errorEvent.target ? {
            readyState: (errorEvent.target as WebSocket).readyState,
            url: (errorEvent.target as WebSocket).url,
            protocol: (errorEvent.target as WebSocket).protocol
          } : null,
          message: errorEvent instanceof ErrorEvent ? errorEvent.message : 'Unknown error'
        };

        console.error("[v0] WebSocket error event details:", errorDetails);

        let errorMessage = "WebSocket connection error";

        if (errorEvent instanceof ErrorEvent && errorEvent.message) {
          errorMessage = `WebSocket error: ${errorEvent.message}`;
        } else if (errorEvent.target instanceof WebSocket) {
          const ws = errorEvent.target;
          const readyStateNames = {
            [WebSocket.CONNECTING]: 'CONNECTING',
            [WebSocket.OPEN]: 'OPEN',
            [WebSocket.CLOSING]: 'CLOSING',
            [WebSocket.CLOSED]: 'CLOSED'
          };

          switch (ws.readyState) {
            case WebSocket.CONNECTING:
              errorMessage = `Failed to connect to WebSocket server (${ws.url})`;
              break;
            case WebSocket.CLOSING:
              errorMessage = "WebSocket connection is closing";
              break;
            case WebSocket.CLOSED:
              errorMessage = "WebSocket connection failed";
              break;
            default:
              errorMessage = `WebSocket error in state: ${readyStateNames[ws.readyState] || ws.readyState}`;
          }
        }

        // Create enhanced error message with troubleshooting steps
        const enhancedErrorMessage = createWebSocketErrorMessage(url, errorMessage);

        console.error("[v0] WebSocket error details:", enhancedErrorMessage);
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
