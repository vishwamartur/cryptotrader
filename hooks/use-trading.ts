"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface OrderData {
  product_id: string
  size: string
  side: "buy" | "sell"
  order_type: "limit_order" | "market_order"
  limit_price?: string
}

interface TradingCredentials {
  api_key: string
  api_secret: string
}

export function useTrading() {
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const { toast } = useToast()

  const placeOrder = async (orderData: OrderData, credentials: TradingCredentials) => {
    setIsPlacingOrder(true)
    try {
      const response = await fetch("/api/trading/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...orderData,
          ...credentials,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Order Placed Successfully",
          description: result.message,
        })
        return { success: true, order: result.order }
      } else {
        toast({
          title: "Order Failed",
          description: result.error,
          variant: "destructive",
        })
        return { success: false, error: result.error }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to place order"
      toast({
        title: "Order Failed",
        description: errorMessage,
        variant: "destructive",
      })
      return { success: false, error: errorMessage }
    } finally {
      setIsPlacingOrder(false)
    }
  }

  return {
    placeOrder,
    isPlacingOrder,
  }
}
