"use client"

import { useState, useEffect } from "react"
import { advancedOrderManager, type AdvancedOrder } from "@/lib/advanced-order-types"

export function useAdvancedOrders() {
  const [orders, setOrders] = useState<AdvancedOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const existingOrders = advancedOrderManager.getAllOrders()
    setOrders(existingOrders)

    const interval = setInterval(() => {
      const updatedOrders = advancedOrderManager.getAllOrders()
      setOrders(updatedOrders)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const createOrder = async (
    type: "ICEBERG" | "TWAP" | "BRACKET" | "TRAILING_STOP",
    params: any,
  ): Promise<AdvancedOrder | null> => {
    setIsLoading(true)
    try {
      let order: AdvancedOrder

      switch (type) {
        case "ICEBERG":
          order = advancedOrderManager.createIcebergOrder(params)
          break
        case "TWAP":
          order = advancedOrderManager.createTWAPOrder(params)
          break
        case "BRACKET":
          order = advancedOrderManager.createBracketOrder(params)
          break
        case "TRAILING_STOP":
          order = advancedOrderManager.createTrailingStop(params)
          break
        default:
          throw new Error(`Unsupported order type: ${type}`)
      }

      setOrders((prev) => [order, ...prev])
      return order
    } catch (error) {
      console.error("Failed to create advanced order:", error)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const cancelOrder = (orderId: string): boolean => {
    const success = advancedOrderManager.cancelOrder(orderId)
    if (success) {
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: "CANCELLED" as const } : order)),
      )
    }
    return success
  }

  const getActiveOrders = (): AdvancedOrder[] => {
    return orders.filter((order) => order.status === "ACTIVE" || order.status === "PENDING")
  }

  return {
    orders,
    activeOrders: getActiveOrders(),
    isLoading,
    createOrder,
    cancelOrder,
  }
}
