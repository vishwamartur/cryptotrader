import { tradeMonitor, type Trade } from "./trade-monitor"
import type { MarketData } from "./types"

export interface TakeProfitLevel {
  id: string
  percentage: number // Percentage of position to close
  priceTarget: number // Target price
  trailingDistance?: number // Trailing stop distance in %
  isActive: boolean
  isTriggered: boolean
  triggeredAt?: Date
  triggeredPrice?: number
}

export interface TakeProfitStrategy {
  id: string
  name: string
  type: "FIXED" | "TRAILING" | "SCALED" | "DYNAMIC"
  levels: TakeProfitLevel[]
  trailingActivationPrice?: number // Price at which trailing starts
  dynamicAdjustment: boolean // Whether to use AI for adjustments
  maxTrailingDistance: number // Maximum trailing distance %
  minTrailingDistance: number // Minimum trailing distance %
}

export interface PositionTakeProfit {
  tradeId: string
  symbol: string
  side: "BUY" | "SELL"
  entryPrice: number
  currentPrice: number
  strategy: TakeProfitStrategy
  highestPrice?: number // For trailing stops
  lowestPrice?: number // For trailing stops (short positions)
  totalProfitRealized: number
  remainingSize: number
  originalSize: number
  isActive: boolean
  lastUpdate: Date
}

export interface TakeProfitEvent {
  id: string
  positionId: string
  type: "LEVEL_TRIGGERED" | "TRAILING_UPDATED" | "PARTIAL_CLOSE" | "FULL_CLOSE"
  levelId?: string
  price: number
  size: number
  profit: number
  timestamp: Date
  reason: string
}

export class TakeProfitSystem {
  private positions: Map<string, PositionTakeProfit> = new Map()
  private events: TakeProfitEvent[] = []
  private subscribers: ((events: TakeProfitEvent[]) => void)[] = []
  private marketData: Map<string, MarketData> = new Map()
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  // Predefined strategies
  private strategies: TakeProfitStrategy[] = [
    {
      id: "conservative",
      name: "Conservative",
      type: "SCALED",
      levels: [
        { id: "tp1", percentage: 30, priceTarget: 0, isActive: true, isTriggered: false },
        { id: "tp2", percentage: 40, priceTarget: 0, isActive: true, isTriggered: false },
        { id: "tp3", percentage: 30, priceTarget: 0, isActive: true, isTriggered: false },
      ],
      dynamicAdjustment: false,
      maxTrailingDistance: 5,
      minTrailingDistance: 2,
    },
    {
      id: "aggressive",
      name: "Aggressive",
      type: "TRAILING",
      levels: [{ id: "tp1", percentage: 100, priceTarget: 0, trailingDistance: 3, isActive: true, isTriggered: false }],
      dynamicAdjustment: true,
      maxTrailingDistance: 8,
      minTrailingDistance: 1,
    },
    {
      id: "balanced",
      name: "Balanced",
      type: "SCALED",
      levels: [
        { id: "tp1", percentage: 25, priceTarget: 0, isActive: true, isTriggered: false },
        { id: "tp2", percentage: 35, priceTarget: 0, trailingDistance: 2, isActive: true, isTriggered: false },
        { id: "tp3", percentage: 40, priceTarget: 0, trailingDistance: 4, isActive: true, isTriggered: false },
      ],
      dynamicAdjustment: true,
      maxTrailingDistance: 6,
      minTrailingDistance: 1.5,
    },
  ]

  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.processPositions()
    }, 1000) // Check every second

    console.log("Take profit system started")
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log("Take profit system stopped")
  }

  addPosition(trade: Trade, strategyId: string, takeProfitPrice?: number): void {
    const strategy = this.getStrategy(strategyId)
    if (!strategy) {
      console.error(`Strategy ${strategyId} not found`)
      return
    }

    // Calculate take profit levels based on strategy
    const levels = this.calculateTakeProfitLevels(trade, strategy, takeProfitPrice)

    const position: PositionTakeProfit = {
      tradeId: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.executedPrice || trade.price,
      currentPrice: trade.executedPrice || trade.price,
      strategy: { ...strategy, levels },
      totalProfitRealized: 0,
      remainingSize: trade.size,
      originalSize: trade.size,
      isActive: true,
      lastUpdate: new Date(),
    }

    this.positions.set(trade.id, position)
    console.log(`Added take profit position for ${trade.symbol}`)
  }

  updateMarketData(symbol: string, data: MarketData): void {
    this.marketData.set(symbol, data)
  }

  private processPositions(): void {
    for (const [tradeId, position] of this.positions) {
      if (!position.isActive) continue

      const marketData = this.marketData.get(position.symbol)
      if (!marketData) continue

      position.currentPrice = marketData.price
      position.lastUpdate = new Date()

      // Update highest/lowest price for trailing stops
      if (position.side === "BUY") {
        position.highestPrice = Math.max(position.highestPrice || position.currentPrice, position.currentPrice)
      } else {
        position.lowestPrice = Math.min(position.lowestPrice || position.currentPrice, position.currentPrice)
      }

      // Process each take profit level
      for (const level of position.strategy.levels) {
        if (!level.isActive || level.isTriggered) continue

        const shouldTrigger = this.shouldTriggerLevel(position, level)
        if (shouldTrigger) {
          this.triggerTakeProfitLevel(position, level)
        } else if (level.trailingDistance) {
          this.updateTrailingStop(position, level)
        }
      }

      // Dynamic adjustment if enabled
      if (position.strategy.dynamicAdjustment) {
        this.adjustTakeProfitDynamically(position)
      }
    }
  }

  private shouldTriggerLevel(position: PositionTakeProfit, level: TakeProfitLevel): boolean {
    if (position.side === "BUY") {
      return position.currentPrice >= level.priceTarget
    } else {
      return position.currentPrice <= level.priceTarget
    }
  }

  private triggerTakeProfitLevel(position: PositionTakeProfit, level: TakeProfitLevel): void {
    const sizeToClose = (position.remainingSize * level.percentage) / 100
    const profit = this.calculateProfit(position, level.priceTarget, sizeToClose)

    // Mark level as triggered
    level.isTriggered = true
    level.triggeredAt = new Date()
    level.triggeredPrice = level.priceTarget

    // Update position
    position.remainingSize -= sizeToClose
    position.totalProfitRealized += profit

    // Create take profit trade
    const takeProfitTrade = tradeMonitor.addTrade({
      symbol: position.symbol,
      side: position.side === "BUY" ? "SELL" : "BUY",
      type: "MARKET",
      size: sizeToClose,
      price: level.priceTarget,
      commission: 0.1,
      source: "TAKE_PROFIT",
      status: "FILLED",
    })

    // Create event
    const event: TakeProfitEvent = {
      id: `event_${Date.now()}`,
      positionId: position.tradeId,
      type: position.remainingSize <= 0.001 ? "FULL_CLOSE" : "PARTIAL_CLOSE",
      levelId: level.id,
      price: level.priceTarget,
      size: sizeToClose,
      profit,
      timestamp: new Date(),
      reason: `Take profit level ${level.id} triggered at $${level.priceTarget}`,
    }

    this.addEvent(event)

    // Close position if fully realized
    if (position.remainingSize <= 0.001) {
      position.isActive = false
    }

    console.log(`Take profit triggered: ${position.symbol} - ${sizeToClose} @ $${level.priceTarget}`)
  }

  private updateTrailingStop(position: PositionTakeProfit, level: TakeProfitLevel): void {
    if (!level.trailingDistance) return

    let newTarget: number

    if (position.side === "BUY") {
      // Long position - trail up
      const trailPrice = (position.highestPrice || position.currentPrice) * (1 - level.trailingDistance / 100)
      newTarget = Math.max(level.priceTarget, trailPrice)
    } else {
      // Short position - trail down
      const trailPrice = (position.lowestPrice || position.currentPrice) * (1 + level.trailingDistance / 100)
      newTarget = Math.min(level.priceTarget, trailPrice)
    }

    if (newTarget !== level.priceTarget) {
      level.priceTarget = newTarget

      const event: TakeProfitEvent = {
        id: `event_${Date.now()}`,
        positionId: position.tradeId,
        type: "TRAILING_UPDATED",
        levelId: level.id,
        price: newTarget,
        size: 0,
        profit: 0,
        timestamp: new Date(),
        reason: `Trailing stop updated to $${newTarget.toFixed(2)}`,
      }

      this.addEvent(event)
    }
  }

  private adjustTakeProfitDynamically(position: PositionTakeProfit): void {
    // This would integrate with the AI engine for dynamic adjustments
    // For now, implement basic volatility-based adjustments
    const marketData = this.marketData.get(position.symbol)
    if (!marketData) return

    const volatility = Math.abs(marketData.change24h)

    // Adjust trailing distances based on volatility
    for (const level of position.strategy.levels) {
      if (level.trailingDistance) {
        let newDistance = level.trailingDistance

        if (volatility > 10) {
          // High volatility - increase trailing distance
          newDistance = Math.min(level.trailingDistance * 1.5, position.strategy.maxTrailingDistance)
        } else if (volatility < 2) {
          // Low volatility - decrease trailing distance
          newDistance = Math.max(level.trailingDistance * 0.8, position.strategy.minTrailingDistance)
        }

        level.trailingDistance = newDistance
      }
    }
  }

  private calculateTakeProfitLevels(
    trade: Trade,
    strategy: TakeProfitStrategy,
    takeProfitPrice?: number,
  ): TakeProfitLevel[] {
    const entryPrice = trade.executedPrice || trade.price
    const isLong = trade.side === "BUY"

    return strategy.levels.map((level, index) => {
      let priceTarget: number

      if (takeProfitPrice && strategy.levels.length === 1) {
        // Single level with specified price
        priceTarget = takeProfitPrice
      } else {
        // Calculate based on percentage gains
        const targetGainPercent = 3 + index * 2 // 3%, 5%, 7% etc.
        if (isLong) {
          priceTarget = entryPrice * (1 + targetGainPercent / 100)
        } else {
          priceTarget = entryPrice * (1 - targetGainPercent / 100)
        }
      }

      return {
        ...level,
        priceTarget,
      }
    })
  }

  private calculateProfit(position: PositionTakeProfit, exitPrice: number, size: number): number {
    if (position.side === "BUY") {
      return (exitPrice - position.entryPrice) * size
    } else {
      return (position.entryPrice - exitPrice) * size
    }
  }

  private addEvent(event: TakeProfitEvent): void {
    this.events.unshift(event)
    this.events = this.events.slice(0, 100) // Keep last 100 events
    this.notifySubscribers()
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.events))
  }

  // Public methods
  getStrategy(id: string): TakeProfitStrategy | undefined {
    return this.strategies.find((s) => s.id === id)
  }

  getStrategies(): TakeProfitStrategy[] {
    return [...this.strategies]
  }

  getActivePositions(): PositionTakeProfit[] {
    return Array.from(this.positions.values()).filter((p) => p.isActive)
  }

  getPosition(tradeId: string): PositionTakeProfit | undefined {
    return this.positions.get(tradeId)
  }

  getEvents(limit = 20): TakeProfitEvent[] {
    return this.events.slice(0, limit)
  }

  removePosition(tradeId: string): void {
    this.positions.delete(tradeId)
  }

  subscribe(callback: (events: TakeProfitEvent[]) => void): () => void {
    this.subscribers.push(callback)
    return () => {
      const index = this.subscribers.indexOf(callback)
      if (index > -1) {
        this.subscribers.splice(index, 1)
      }
    }
  }

  addCustomStrategy(strategy: TakeProfitStrategy): void {
    this.strategies.push(strategy)
  }

  updateStrategy(id: string, updates: Partial<TakeProfitStrategy>): void {
    const index = this.strategies.findIndex((s) => s.id === id)
    if (index > -1) {
      this.strategies[index] = { ...this.strategies[index], ...updates }
    }
  }
}

// Global take profit system instance
export const takeProfitSystem = new TakeProfitSystem()
