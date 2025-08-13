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

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("WebSocket connected")
        setIsConnected(true)
        setError(null)
        setReconnectAttempts(0)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const channel = data.type || data.channel

          if (channel && messageHandlersRef.current.has(channel)) {
            const handler = messageHandlersRef.current.get(channel)
            handler?.(data)
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err)
        }
      }

      ws.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason)
        setIsConnected(false)

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1)
            connect()
          }, reconnectInterval)
        } else {
          setError("Max reconnection attempts reached")
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        setError("WebSocket connection error")
      }
    } catch (err) {
      console.error("Error creating WebSocket connection:", err)
      setError("Failed to create WebSocket connection")
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
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const message = "GET" + timestamp + "/live"
      const signature = await generateHmacSha256(message, apiSecret)

      const authMessage: AuthMessage = {
        type: "auth",
        api_key: apiKey,
        signature,
        timestamp,
      }

      sendMessage(authMessage)
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
