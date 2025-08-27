// HFT Order Book Modeling & Tick-Level Strategy Engine
// For ultra-low latency, event-driven trading

export type OrderBookLevel = {
  price: number;
  size: number;
};

export type OrderBookSnapshot = {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
};

export class RealTimeOrderBook {
  private bids: OrderBookLevel[] = [];
  private asks: OrderBookLevel[] = [];
  private lastUpdate: number = Date.now();

  update(snapshot: OrderBookSnapshot) {
    this.bids = snapshot.bids;
    this.asks = snapshot.asks;
    this.lastUpdate = snapshot.timestamp;
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
}

// Tick-level event-driven strategy engine
export type TickEvent = {
  orderBook: OrderBookSnapshot;
  trades?: { price: number; size: number; side: 'buy' | 'sell'; timestamp: number }[];
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
