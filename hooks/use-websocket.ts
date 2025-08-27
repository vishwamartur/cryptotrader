"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { generateHmacSha256 } from "../lib/crypto-utils"

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

      if (!url || (!url.startsWith("ws://") && !url.startsWith("wss://"))) {
        setError("Invalid WebSocket URL provided")
        return
      }

      console.log("[v0] Attempting to connect to WebSocket:", url)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[v0] WebSocket connected successfully")
        setIsConnected(true)
        setError(null)
        setReconnectAttempts(0)
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
        console.log(
          "[v0] WebSocket disconnected - Code:",
          event.code,
          "Reason:",
          event.reason,
          "Clean:",
          event.wasClean,
        )
        setIsConnected(false)

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
        console.error("[v0] WebSocket error event:", errorEvent)

        let errorMessage = "WebSocket connection error"

        if (errorEvent instanceof ErrorEvent) {
          errorMessage = `WebSocket error: ${errorEvent.message}`
        } else if (errorEvent.target instanceof WebSocket) {
          const ws = errorEvent.target
          switch (ws.readyState) {
            case WebSocket.CONNECTING:
              errorMessage = "Failed to connect to WebSocket server"
              break
            case WebSocket.CLOSING:
              errorMessage = "WebSocket connection is closing"
              break
            case WebSocket.CLOSED:
              errorMessage = "WebSocket connection failed"
              break
            default:
              errorMessage = "Unknown WebSocket error"
          }
        }

        if (url.includes("delta.exchange") || url.includes("deltaex.org")) {
          errorMessage += " - Please check if Delta Exchange WebSocket service is available"
        }

        console.error("[v0] WebSocket error details:", errorMessage)
        setError(errorMessage)
      }
    } catch (err) {
      console.error("[v0] Error creating WebSocket connection:", err)
      setError(`Failed to create WebSocket connection: ${err instanceof Error ? err.message : "Unknown error"}`)
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
