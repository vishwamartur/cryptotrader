// HFT Order Book Modeling & Tick-Level Strategy Engine
// For ultra-low latency, event-driven trading with advanced market microstructure analysis

export interface OrderBookLevel {
  price: number;
  size: number;
  orders?: number; // Number of orders at this level
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
  sequence?: number; // Sequence number for ordering
}

export interface Trade {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
  aggressor?: 'buyer' | 'seller';
}

export interface OrderBookMetrics {
  spread: number;
  midPrice: number;
  weightedMidPrice: number;
  bidVolume: number;
  askVolume: number;
  imbalance: number;
  depth: { bid: number; ask: number };
  volatility: number;
  microPrice: number;
}

export class RealTimeOrderBook {
  private bids: OrderBookLevel[] = [];
  private asks: OrderBookLevel[] = [];
  private lastUpdate: number = Date.now();
  private priceHistory: number[] = [];
  private tradeHistory: Trade[] = [];
  private maxHistoryLength: number = 1000;

  constructor(maxHistoryLength: number = 1000) {
    this.maxHistoryLength = maxHistoryLength;
  }

  update(snapshot: OrderBookSnapshot): void {
    this.bids = [...snapshot.bids].sort((a, b) => b.price - a.price); // Sort descending
    this.asks = [...snapshot.asks].sort((a, b) => a.price - b.price); // Sort ascending
    this.lastUpdate = snapshot.timestamp;

    // Update price history
    const midPrice = this.getMidPrice();
    if (!isNaN(midPrice)) {
      this.priceHistory.push(midPrice);
      if (this.priceHistory.length > this.maxHistoryLength) {
        this.priceHistory.shift();
      }
    }
  }

  addTrade(trade: Trade): void {
    this.tradeHistory.push(trade);
    if (this.tradeHistory.length > this.maxHistoryLength) {
      this.tradeHistory.shift();
    }
  }

  getBestBid(): OrderBookLevel | null {
    return this.bids.length > 0 ? this.bids[0] : null;
  }

  getBestAsk(): OrderBookLevel | null {
    return this.asks.length > 0 ? this.asks[0] : null;
  }

  getSpread(): number {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    return bid && ask ? ask.price - bid.price : NaN;
  }

  getMidPrice(): number {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    return bid && ask ? (bid.price + ask.price) / 2 : NaN;
  }

  getWeightedMidPrice(): number {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    if (!bid || !ask) return NaN;

    const totalSize = bid.size + ask.size;
    return totalSize > 0 ? (bid.price * ask.size + ask.price * bid.size) / totalSize : this.getMidPrice();
  }

  getMicroPrice(): number {
    // Micro price considers the next level in the book
    if (this.bids.length < 2 || this.asks.length < 2) return this.getMidPrice();

    const bid1 = this.bids[0];
    const bid2 = this.bids[1];
    const ask1 = this.asks[0];
    const ask2 = this.asks[1];

    const bidWeight = bid1.size / (bid1.size + ask1.size);
    const askWeight = ask1.size / (bid1.size + ask1.size);

    return bidWeight * ask1.price + askWeight * bid1.price;
  }

  getOrderBookImbalance(): number {
    const bid = this.getBestBid();
    const ask = this.getBestAsk();
    if (!bid || !ask) return 0;

    const totalVolume = bid.size + ask.size;
    return totalVolume > 0 ? (bid.size - ask.size) / totalVolume : 0;
  }

  getDepth(levels: number = 5): { bid: number; ask: number } {
    const bidDepth = this.bids.slice(0, levels).reduce((sum, level) => sum + level.size, 0);
    const askDepth = this.asks.slice(0, levels).reduce((sum, level) => sum + level.size, 0);
    return { bid: bidDepth, ask: askDepth };
  }

  getVolumeWeightedAveragePrice(side: 'bid' | 'ask', volume: number): number {
    const levels = side === 'bid' ? this.bids : this.asks;
    let remainingVolume = volume;
    let totalCost = 0;
    let totalVolume = 0;

    for (const level of levels) {
      if (remainingVolume <= 0) break;

      const volumeAtLevel = Math.min(remainingVolume, level.size);
      totalCost += volumeAtLevel * level.price;
      totalVolume += volumeAtLevel;
      remainingVolume -= volumeAtLevel;
    }

    return totalVolume > 0 ? totalCost / totalVolume : NaN;
  }

  getVolatility(periods: number = 20): number {
    if (this.priceHistory.length < periods) return 0;

    const recentPrices = this.priceHistory.slice(-periods);
    const returns = recentPrices.slice(1).map((price, i) =>
      Math.log(price / recentPrices[i])
    );

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  getMetrics(): OrderBookMetrics {
    const spread = this.getSpread();
    const midPrice = this.getMidPrice();
    const weightedMidPrice = this.getWeightedMidPrice();
    const imbalance = this.getOrderBookImbalance();
    const depth = this.getDepth();
    const volatility = this.getVolatility();
    const microPrice = this.getMicroPrice();

    return {
      spread,
      midPrice,
      weightedMidPrice,
      bidVolume: depth.bid,
      askVolume: depth.ask,
      imbalance,
      depth,
      volatility,
      microPrice
    };
  }

  // Market impact estimation
  estimateMarketImpact(side: 'buy' | 'sell', volume: number): { averagePrice: number; impact: number } {
    const levels = side === 'buy' ? this.asks : this.bids;
    const midPrice = this.getMidPrice();

    if (isNaN(midPrice)) return { averagePrice: NaN, impact: NaN };

    const averagePrice = this.getVolumeWeightedAveragePrice(side === 'buy' ? 'ask' : 'bid', volume);
    const impact = side === 'buy' ?
      (averagePrice - midPrice) / midPrice :
      (midPrice - averagePrice) / midPrice;

    return { averagePrice, impact };
  }

  // Liquidity analysis
  getLiquidityMetrics(maxLevels: number = 10): {
    totalBidLiquidity: number;
    totalAskLiquidity: number;
    averageBidSize: number;
    averageAskSize: number;
    liquidityImbalance: number;
  } {
    const bidLevels = this.bids.slice(0, maxLevels);
    const askLevels = this.asks.slice(0, maxLevels);

    const totalBidLiquidity = bidLevels.reduce((sum, level) => sum + level.size, 0);
    const totalAskLiquidity = askLevels.reduce((sum, level) => sum + level.size, 0);

    const averageBidSize = bidLevels.length > 0 ? totalBidLiquidity / bidLevels.length : 0;
    const averageAskSize = askLevels.length > 0 ? totalAskLiquidity / askLevels.length : 0;

    const totalLiquidity = totalBidLiquidity + totalAskLiquidity;
    const liquidityImbalance = totalLiquidity > 0 ?
      (totalBidLiquidity - totalAskLiquidity) / totalLiquidity : 0;

    return {
      totalBidLiquidity,
      totalAskLiquidity,
      averageBidSize,
      averageAskSize,
      liquidityImbalance
    };
  }
}

// --- Tick-level Event-Driven Strategy Engine ---
export interface TickEvent {
  type: 'orderbook' | 'trade' | 'quote';
  orderBook?: OrderBookSnapshot;
  trades?: Trade[];
  timestamp: number;
  symbol: string;
}

export interface HFTSignal {
  action: 'buy' | 'sell' | 'hold' | 'cancel';
  price?: number;
  size?: number;
  confidence: number;
  strategy: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
}

export abstract class HFTStrategy {
  protected name: string;
  protected orderBook: RealTimeOrderBook;
  protected enabled: boolean = true;

  constructor(name: string) {
    this.name = name;
    this.orderBook = new RealTimeOrderBook();
  }

  abstract onTick(event: TickEvent): HFTSignal[];

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getName(): string {
    return this.name;
  }
}

// --- Market Making Strategy ---
export class MarketMakingStrategy extends HFTStrategy {
  private targetSpread: number;
  private maxPosition: number;
  private currentPosition: number = 0;
  private riskMultiplier: number;
  private minProfitTicks: number;

  constructor(
    targetSpread: number = 0.0001,
    maxPosition: number = 10,
    riskMultiplier: number = 1.5,
    minProfitTicks: number = 1
  ) {
    super('MarketMaking');
    this.targetSpread = targetSpread;
    this.maxPosition = maxPosition;
    this.riskMultiplier = riskMultiplier;
    this.minProfitTicks = minProfitTicks;
  }

  onTick(event: TickEvent): HFTSignal[] {
    if (!this.enabled || !event.orderBook) return [];

    this.orderBook.update(event.orderBook);
    const metrics = this.orderBook.getMetrics();

    if (isNaN(metrics.midPrice) || isNaN(metrics.spread)) return [];

    const signals: HFTSignal[] = [];

    // Calculate optimal bid/ask prices
    const halfSpread = Math.max(this.targetSpread / 2, metrics.spread / 2 + 0.00001);
    const bidPrice = metrics.midPrice - halfSpread;
    const askPrice = metrics.midPrice + halfSpread;

    // Position-based risk adjustment
    const positionRisk = Math.abs(this.currentPosition) / this.maxPosition;
    const riskAdjustment = positionRisk * this.riskMultiplier;

    // Inventory management
    if (Math.abs(this.currentPosition) < this.maxPosition) {
      // Place bid order (buy)
      if (this.currentPosition > -this.maxPosition * 0.8) {
        const adjustedBidPrice = bidPrice * (1 - riskAdjustment * 0.001);
        signals.push({
          action: 'buy',
          price: adjustedBidPrice,
          size: this.calculateOrderSize(metrics),
          confidence: this.calculateConfidence(metrics, 'buy'),
          strategy: this.name,
          urgency: this.getUrgency(metrics),
          metadata: { type: 'market_making', side: 'bid' }
        });
      }

      // Place ask order (sell)
      if (this.currentPosition < this.maxPosition * 0.8) {
        const adjustedAskPrice = askPrice * (1 + riskAdjustment * 0.001);
        signals.push({
          action: 'sell',
          price: adjustedAskPrice,
          size: this.calculateOrderSize(metrics),
          confidence: this.calculateConfidence(metrics, 'sell'),
          strategy: this.name,
          urgency: this.getUrgency(metrics),
          metadata: { type: 'market_making', side: 'ask' }
        });
      }
    }

    return signals;
  }

  private calculateOrderSize(metrics: OrderBookMetrics): number {
    // Base size adjusted for market conditions
    const baseSize = 1.0;
    const volatilityAdjustment = Math.max(0.1, 1 - metrics.volatility * 10);
    const liquidityAdjustment = Math.min(2.0, (metrics.bidVolume + metrics.askVolume) / 100);

    return baseSize * volatilityAdjustment * liquidityAdjustment;
  }

  private calculateConfidence(metrics: OrderBookMetrics, side: 'buy' | 'sell'): number {
    let confidence = 0.5;

    // Spread-based confidence
    const normalizedSpread = metrics.spread / metrics.midPrice;
    confidence += Math.min(0.3, normalizedSpread * 1000); // Higher spread = higher confidence

    // Imbalance-based confidence
    if (side === 'buy' && metrics.imbalance > 0) confidence += 0.1;
    if (side === 'sell' && metrics.imbalance < 0) confidence += 0.1;

    // Volatility adjustment
    confidence -= Math.min(0.2, metrics.volatility * 5);

    return Math.max(0.1, Math.min(0.9, confidence));
  }

  private getUrgency(metrics: OrderBookMetrics): 'low' | 'medium' | 'high' | 'critical' {
    const normalizedSpread = metrics.spread / metrics.midPrice;
    const volatility = metrics.volatility;

    if (volatility > 0.02 || normalizedSpread > 0.001) return 'critical';
    if (volatility > 0.01 || normalizedSpread > 0.0005) return 'high';
    if (volatility > 0.005) return 'medium';
    return 'low';
  }

  updatePosition(change: number): void {
    this.currentPosition += change;
  }

  getCurrentPosition(): number {
    return this.currentPosition;
  }
}

// --- Arbitrage Strategy ---
export class ArbitrageStrategy extends HFTStrategy {
  private minProfitThreshold: number;
  private maxLatency: number;
  private exchanges: Map<string, RealTimeOrderBook> = new Map();

  constructor(minProfitThreshold: number = 0.0005, maxLatency: number = 100) {
    super('Arbitrage');
    this.minProfitThreshold = minProfitThreshold;
    this.maxLatency = maxLatency;
  }

  addExchange(name: string, orderBook: RealTimeOrderBook): void {
    this.exchanges.set(name, orderBook);
  }

  onTick(event: TickEvent): HFTSignal[] {
    if (!this.enabled || !event.orderBook) return [];

    const signals: HFTSignal[] = [];
    const currentExchange = event.symbol;

    // Update the order book for the current exchange
    if (!this.exchanges.has(currentExchange)) {
      this.exchanges.set(currentExchange, new RealTimeOrderBook());
    }

    const currentOrderBook = this.exchanges.get(currentExchange)!;
    currentOrderBook.update(event.orderBook);

    // Look for arbitrage opportunities across exchanges
    for (const [exchangeName, orderBook] of this.exchanges) {
      if (exchangeName === currentExchange) continue;

      const opportunity = this.findArbitrageOpportunity(currentOrderBook, orderBook);
      if (opportunity) {
        signals.push(...this.createArbitrageSignals(opportunity, currentExchange, exchangeName));
      }
    }

    return signals;
  }

  private findArbitrageOpportunity(
    orderBook1: RealTimeOrderBook,
    orderBook2: RealTimeOrderBook
  ): { buyExchange: string; sellExchange: string; profit: number; volume: number } | null {
    const metrics1 = orderBook1.getMetrics();
    const metrics2 = orderBook2.getMetrics();

    if (isNaN(metrics1.midPrice) || isNaN(metrics2.midPrice)) return null;

    // Check if we can buy on exchange 1 and sell on exchange 2
    const bid1 = orderBook1.getBestBid();
    const ask1 = orderBook1.getBestAsk();
    const bid2 = orderBook2.getBestBid();
    const ask2 = orderBook2.getBestAsk();

    if (!bid1 || !ask1 || !bid2 || !ask2) return null;

    // Opportunity 1: Buy on exchange 1, sell on exchange 2
    if (bid2.price > ask1.price) {
      const profit = (bid2.price - ask1.price) / ask1.price;
      if (profit > this.minProfitThreshold) {
        const volume = Math.min(bid2.size, ask1.size);
        return { buyExchange: '1', sellExchange: '2', profit, volume };
      }
    }

    // Opportunity 2: Buy on exchange 2, sell on exchange 1
    if (bid1.price > ask2.price) {
      const profit = (bid1.price - ask2.price) / ask2.price;
      if (profit > this.minProfitThreshold) {
        const volume = Math.min(bid1.size, ask2.size);
        return { buyExchange: '2', sellExchange: '1', profit, volume };
      }
    }

    return null;
  }

  private createArbitrageSignals(
    opportunity: { buyExchange: string; sellExchange: string; profit: number; volume: number },
    exchange1: string,
    exchange2: string
  ): HFTSignal[] {
    const urgency = opportunity.profit > this.minProfitThreshold * 2 ? 'critical' : 'high';

    return [
      {
        action: 'buy',
        size: opportunity.volume,
        confidence: Math.min(0.95, opportunity.profit * 100),
        strategy: this.name,
        urgency,
        metadata: {
          type: 'arbitrage',
          exchange: opportunity.buyExchange === '1' ? exchange1 : exchange2,
          profit: opportunity.profit
        }
      },
      {
        action: 'sell',
        size: opportunity.volume,
        confidence: Math.min(0.95, opportunity.profit * 100),
        strategy: this.name,
        urgency,
        metadata: {
          type: 'arbitrage',
          exchange: opportunity.sellExchange === '1' ? exchange1 : exchange2,
          profit: opportunity.profit
        }
      }
    ];
  }
}

// --- Momentum Strategy ---
export class MomentumStrategy extends HFTStrategy {
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private momentumThreshold: number;
  private lookbackPeriod: number;

  constructor(momentumThreshold: number = 0.001, lookbackPeriod: number = 10) {
    super('Momentum');
    this.momentumThreshold = momentumThreshold;
    this.lookbackPeriod = lookbackPeriod;
  }

  onTick(event: TickEvent): HFTSignal[] {
    if (!this.enabled || !event.orderBook) return [];

    this.orderBook.update(event.orderBook);
    const metrics = this.orderBook.getMetrics();

    if (isNaN(metrics.midPrice)) return [];

    // Update history
    this.priceHistory.push(metrics.midPrice);
    this.volumeHistory.push(metrics.bidVolume + metrics.askVolume);

    if (this.priceHistory.length > this.lookbackPeriod) {
      this.priceHistory.shift();
      this.volumeHistory.shift();
    }

    if (this.priceHistory.length < this.lookbackPeriod) return [];

    const signals: HFTSignal[] = [];
    const momentum = this.calculateMomentum();
    const volumeMomentum = this.calculateVolumeMomentum();

    if (Math.abs(momentum) > this.momentumThreshold) {
      const action = momentum > 0 ? 'buy' : 'sell';
      const confidence = Math.min(0.9, Math.abs(momentum) * 100);
      const urgency = Math.abs(momentum) > this.momentumThreshold * 2 ? 'high' : 'medium';

      signals.push({
        action,
        size: this.calculatePositionSize(momentum, volumeMomentum),
        confidence,
        strategy: this.name,
        urgency,
        metadata: {
          type: 'momentum',
          momentum,
          volumeMomentum,
          priceChange: momentum
        }
      });
    }

    return signals;
  }

  private calculateMomentum(): number {
    if (this.priceHistory.length < 2) return 0;

    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    const previousPrice = this.priceHistory[0];

    return (currentPrice - previousPrice) / previousPrice;
  }

  private calculateVolumeMomentum(): number {
    if (this.volumeHistory.length < 2) return 0;

    const recentVolume = this.volumeHistory.slice(-3).reduce((sum, v) => sum + v, 0) / 3;
    const historicalVolume = this.volumeHistory.slice(0, -3).reduce((sum, v) => sum + v, 0) / (this.volumeHistory.length - 3);

    return historicalVolume > 0 ? (recentVolume - historicalVolume) / historicalVolume : 0;
  }

  private calculatePositionSize(momentum: number, volumeMomentum: number): number {
    const baseSize = 1.0;
    const momentumMultiplier = Math.min(2.0, Math.abs(momentum) * 100);
    const volumeMultiplier = Math.min(1.5, 1 + Math.abs(volumeMomentum));

    return baseSize * momentumMultiplier * volumeMultiplier;
  }
}

// --- HFT Engine ---
export class HFTEngine {
  private strategies: Map<string, HFTStrategy> = new Map();
  private signalHistory: HFTSignal[] = [];
  private maxSignalHistory: number = 10000;
  private latencyTracker: Map<string, number[]> = new Map();

  addStrategy(strategy: HFTStrategy): void {
    this.strategies.set(strategy.getName(), strategy);
  }

  removeStrategy(name: string): void {
    this.strategies.delete(name);
  }

  processTick(event: TickEvent): HFTSignal[] {
    const startTime = performance.now();
    const allSignals: HFTSignal[] = [];

    for (const [name, strategy] of this.strategies) {
      if (!strategy.isEnabled()) continue;

      try {
        const strategyStartTime = performance.now();
        const signals = strategy.onTick(event);
        const strategyLatency = performance.now() - strategyStartTime;

        // Track latency
        if (!this.latencyTracker.has(name)) {
          this.latencyTracker.set(name, []);
        }
        const latencies = this.latencyTracker.get(name)!;
        latencies.push(strategyLatency);
        if (latencies.length > 1000) latencies.shift();

        allSignals.push(...signals);
      } catch (error) {
        console.error(`Error in strategy ${name}:`, error);
      }
    }

    // Store signal history
    this.signalHistory.push(...allSignals);
    if (this.signalHistory.length > this.maxSignalHistory) {
      this.signalHistory.splice(0, this.signalHistory.length - this.maxSignalHistory);
    }

    const totalLatency = performance.now() - startTime;
    console.log(`HFT Engine processed tick in ${totalLatency.toFixed(2)}ms, generated ${allSignals.length} signals`);

    return allSignals;
  }

  getLatencyStats(): { [strategyName: string]: { avg: number; max: number; min: number } } {
    const stats: { [strategyName: string]: { avg: number; max: number; min: number } } = {};

    for (const [name, latencies] of this.latencyTracker) {
      if (latencies.length === 0) continue;

      const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      const max = Math.max(...latencies);
      const min = Math.min(...latencies);

      stats[name] = { avg, max, min };
    }

    return stats;
  }

  getSignalHistory(limit?: number): HFTSignal[] {
    return limit ? this.signalHistory.slice(-limit) : [...this.signalHistory];
  }
};

export type TickStrategy = {
  name: string;
  onTick: (event: TickEvent) => void;
};

export class TickStrategyEngine {
  private strategies: TickStrategy[] = [];

  addStrategy(strategy: TickStrategy) {
    this.strategies.push(strategy);
  }

  onTick(event: TickEvent) {
    for (const strategy of this.strategies) {
      strategy.onTick(event);
    }
  }
}

// Example: Simple market making strategy template
export const SimpleMarketMaker: TickStrategy = {
  name: 'Simple Market Maker',
  onTick: (event: TickEvent) => {
    const mid = (event.orderBook.bids[0].price + event.orderBook.asks[0].price) / 2;
    // TODO: Place bid/ask orders around mid, manage inventory, etc.
    // For real HFT, integrate with websocket feeds and fast order APIs
  },
};
