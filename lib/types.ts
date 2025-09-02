// Delta Exchange API types
export interface Product {
  id: number
  symbol: string
  description: string
  created_at: string
  updated_at: string
  settlement_time: string
  notional_type: string
  impact_size: number
  initial_margin: number
  maintenance_margin: number
  contract_value: string
  contract_unit_currency: string
  tick_size: string
  product_specs: any
  state: string
  trading_status: string
  max_leverage_notional: string
  default_leverage: string
  initial_margin_scaling_factor: string
  maintenance_margin_scaling_factor: string
  taker_commission_rate: string
  maker_commission_rate: string
  liquidation_penalty_factor: string
  contract_type: string
  position_size_limit: number
  basis_factor_max_limit: string
  is_quanto: boolean
  funding_method: string
  annualized_funding: string
  price_band: string
  underlying_asset: any
  quoting_asset: any
  settling_asset: any
  spot_index: any
}

export interface Ticker {
  symbol: string
  price: string
  size: string
  buyer_commission: string
  seller_commission: string
  timestamp: number
}

export interface Balance {
  asset_id: number
  asset_symbol: string
  available_balance: string
  available_balance_for_robo: string
  position_margin: string
  order_margin: string
  commission: string
  pending_referral_bonus: string
  pending_trading_fee_credits: string
  wallet_balance: string
  unrealized_pnl: string
  deposit_in_progress: string
  withdrawal_in_progress: string
  cross_asset_liability: string
  interest_credit: string
  pending_trading_rewards: string
  trading_fee_credits: string
  referral_bonus: string
  cashflow_from_interest_bearing_tokens: string
}

export interface Position {
  user_id: number
  size: string
  entry_price: string
  margin: string
  liquidation_price: string
  bankruptcy_price: string
  adl_level: number
  auto_topup: boolean
  realized_pnl: string
  realized_funding: string
  product: Product
  // Optional fields for test data and extended functionality
  unrealized_pnl?: string
  mark_price?: string
  id?: string
}

export interface Order {
  id: number
  user_id: number
  size: string
  unfilled_size: string
  side: "buy" | "sell"
  order_type: "limit_order" | "market_order"
  limit_price: string
  stop_order_type: string
  stop_price: string
  paid_commission: string
  commission: string
  reduce_only: boolean
  client_order_id: string
  state: "open" | "pending" | "closed" | "cancelled"
  created_at: string
  product: Product
}

export interface MarketData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  high24h: number
  low24h: number
  lastUpdated: number
}

export interface OrderBookEntry {
  price: number
  size: number
  total: number
}

export interface OrderBook {
  bids: OrderBookEntry[]
  asks: OrderBookEntry[]
  lastUpdated: number
}

export interface TradeData {
  id: string
  symbol: string
  side: "buy" | "sell"
  size: number
  price: number
  timestamp: number
  fee: number
  pnl?: number
}

export interface PortfolioSummary {
  totalValue: number
  totalPnl: number
  totalPnlPercent: number
  availableBalance: number
  marginUsed: number
  marginAvailable: number
}

export interface RiskMetrics {
  portfolioRisk: number
  maxDrawdown: number
  sharpeRatio: number
  winRate: number
  profitFactor: number
  totalTrades: number
}

export interface AISignal {
  symbol: string
  action: "buy" | "sell" | "hold"
  confidence: number
  reasoning: string
  targetPrice?: number
  stopLoss?: number
  timestamp: number
}

export interface TradingStrategy {
  id: string
  name: string
  description: string
  riskLevel: "low" | "medium" | "high"
  expectedReturn: number
  maxDrawdown: number
  active: boolean
}
