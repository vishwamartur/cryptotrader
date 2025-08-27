// Quant Risk Management Module
// Provides position sizing, stop-loss, and portfolio allocation logic

export type RiskParameters = {
  maxPositionSize: number; // e.g., in USD
  stopLossPercent: number; // e.g., 0.05 for 5%
  maxPortfolioAllocation: number; // e.g., 0.2 for 20%
};

export type Position = {
  symbol: string;
  quantity: number;
  entryPrice: number;
};

export class QuantRiskManager {
  constructor(private params: RiskParameters) {}

  calculatePositionSize(accountBalance: number, price: number): number {
    const size = Math.min(
      accountBalance * this.params.maxPortfolioAllocation / price,
      this.params.maxPositionSize / price
    );
    return Math.floor(size);
  }

  calculateStopLoss(entryPrice: number): number {
    return entryPrice * (1 - this.params.stopLossPercent);
  }

  checkRisk(position: Position, accountBalance: number): boolean {
    const positionValue = position.quantity * position.entryPrice;
    return (
      positionValue <= this.params.maxPositionSize &&
      positionValue <= accountBalance * this.params.maxPortfolioAllocation
    );
  }
}
