// Quant RL Module: Reinforcement Learning for Trading
// Advanced RL environment and Q-learning agent for autonomous trading

import { MarketData } from './market-data-provider';
import { TechnicalFeatures, extractAdvancedFeatures } from './quant-ml';

// --- Enhanced RL Environment ---
export interface TradingState {
  // Market features
  price: number;
  volume: number;
  volatility: number;
  rsi: number;
  macd: number;

  // Portfolio state
  position: number; // -1: short, 0: flat, 1: long
  balance: number;
  equity: number;
  unrealizedPnL: number;

  // Trading metrics
  step: number;
  tradesCount: number;
  winRate: number;
  maxDrawdown: number;

  // Risk metrics
  sharpeRatio: number;
  exposureRatio: number;
}

export type TradingAction = 0 | 1 | 2; // 0: sell/short, 1: hold, 2: buy/long

export interface TradingReward {
  total: number;
  components: {
    profit: number;
    risk: number;
    transaction: number;
    drawdown: number;
  };
}

export class TradingRLEnvironment {
  private data: MarketData[];
  private features: TechnicalFeatures[];
  private state: TradingState;
  private currentStep: number = 0;
  private initialBalance: number;
  private transactionCost: number;
  private maxPosition: number;

  // Performance tracking
  private trades: Array<{ price: number; action: TradingAction; pnl: number; timestamp: number }> = [];
  private portfolioHistory: number[] = [];
  private maxEquity: number;

  constructor(
    data: MarketData[],
    initialBalance: number = 10000,
    transactionCost: number = 0.001,
    maxPosition: number = 1
  ) {
    this.data = data;
    this.initialBalance = initialBalance;
    this.transactionCost = transactionCost;
    this.maxPosition = maxPosition;
    this.maxEquity = initialBalance;

    // Extract technical features
    this.features = extractAdvancedFeatures(data);

    this.state = this.createInitialState();
  }

  private createInitialState(): TradingState {
    const firstFeature = this.features[0];
    return {
      // Market features
      price: firstFeature.price,
      volume: firstFeature.volume,
      volatility: firstFeature.volatility,
      rsi: firstFeature.rsi,
      macd: firstFeature.macd,

      // Portfolio state
      position: 0,
      balance: this.initialBalance,
      equity: this.initialBalance,
      unrealizedPnL: 0,

      // Trading metrics
      step: 0,
      tradesCount: 0,
      winRate: 0,
      maxDrawdown: 0,

      // Risk metrics
      sharpeRatio: 0,
      exposureRatio: 0
    };
  }

  reset(): TradingState {
    this.currentStep = 0;
    this.trades = [];
    this.portfolioHistory = [];
    this.maxEquity = this.initialBalance;
    this.state = this.createInitialState();
    return this.state;
  }

  step(action: TradingAction): { nextState: TradingState; reward: TradingReward; done: boolean } {
    this.currentStep++;

    if (this.currentStep >= this.features.length) {
      return { nextState: this.state, reward: this.createReward(0, 0, 0, 0), done: true };
    }

    const prevState = { ...this.state };
    const currentFeature = this.features[this.currentStep];
    const prevPrice = this.state.price;
    const currentPrice = currentFeature.price;
    const priceChange = currentPrice - prevPrice;

    // Execute action and calculate immediate reward components
    const { profit, transactionCost } = this.executeAction(action, prevPrice, currentPrice);

    // Update portfolio state
    this.updatePortfolioState(currentFeature, profit, transactionCost);

    // Calculate comprehensive reward
    const reward = this.calculateReward(prevState, profit, transactionCost);

    // Update performance metrics
    this.updatePerformanceMetrics();

    const done = this.currentStep >= this.features.length - 1 || this.state.equity <= this.initialBalance * 0.1;

    return { nextState: this.state, reward, done };
  }

  private executeAction(action: TradingAction, prevPrice: number, currentPrice: number): { profit: number; transactionCost: number } {
    let profit = 0;
    let transactionCost = 0;
    const positionSize = this.maxPosition;

    // Calculate unrealized P&L from existing position
    if (this.state.position !== 0) {
      profit = this.state.position * (currentPrice - prevPrice) * positionSize;
    }

    // Execute new action
    if (action === 2 && this.state.position < this.maxPosition) { // Buy/Long
      const newPosition = Math.min(this.maxPosition, this.state.position + 1);
      const positionChange = newPosition - this.state.position;
      transactionCost = Math.abs(positionChange) * currentPrice * this.transactionCost;

      if (this.state.balance >= currentPrice * positionChange + transactionCost) {
        this.state.position = newPosition;
        this.state.balance -= currentPrice * positionChange + transactionCost;
        this.trades.push({ price: currentPrice, action, pnl: 0, timestamp: this.currentStep });
      }
    } else if (action === 0 && this.state.position > -this.maxPosition) { // Sell/Short
      const newPosition = Math.max(-this.maxPosition, this.state.position - 1);
      const positionChange = this.state.position - newPosition;
      transactionCost = Math.abs(positionChange) * currentPrice * this.transactionCost;

      this.state.position = newPosition;
      this.state.balance += currentPrice * positionChange - transactionCost;
      this.trades.push({ price: currentPrice, action, pnl: 0, timestamp: this.currentStep });
    }
    // action === 1 is hold, no execution needed

    return { profit, transactionCost };
  }

  private updatePortfolioState(feature: TechnicalFeatures, profit: number, transactionCost: number): void {
    // Update market features
    this.state.price = feature.price;
    this.state.volume = feature.volume;
    this.state.volatility = feature.volatility;
    this.state.rsi = feature.rsi;
    this.state.macd = feature.macd;

    // Calculate unrealized P&L
    this.state.unrealizedPnL = this.state.position * feature.price;

    // Update equity
    this.state.equity = this.state.balance + this.state.unrealizedPnL;

    // Track portfolio history
    this.portfolioHistory.push(this.state.equity);

    // Update max equity for drawdown calculation
    if (this.state.equity > this.maxEquity) {
      this.maxEquity = this.state.equity;
    }

    // Update step
    this.state.step = this.currentStep;
  }

  private calculateReward(prevState: TradingState, profit: number, transactionCost: number): TradingReward {
    // Profit component (main driver)
    const profitReward = profit / this.initialBalance * 100; // Normalize by initial balance

    // Risk penalty (volatility and drawdown)
    const currentDrawdown = (this.maxEquity - this.state.equity) / this.maxEquity;
    const drawdownPenalty = -currentDrawdown * 50; // Heavy penalty for drawdown

    // Transaction cost penalty
    const transactionPenalty = -transactionCost / this.initialBalance * 100;

    // Risk-adjusted return bonus
    const returns = this.portfolioHistory.length > 1 ?
      this.portfolioHistory.map((val, i) => i > 0 ? (val - this.portfolioHistory[i-1]) / this.portfolioHistory[i-1] : 0).slice(1) : [];

    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const returnStd = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) : 0.01;
    const sharpeBonus = returnStd > 0 ? (avgReturn / returnStd) * 5 : 0;

    // Position management reward (encourage balanced trading)
    const positionPenalty = Math.abs(this.state.position) > 0.8 * this.maxPosition ? -5 : 0;

    const totalReward = profitReward + drawdownPenalty + transactionPenalty + sharpeBonus + positionPenalty;

    return this.createReward(totalReward, profitReward, drawdownPenalty + positionPenalty, transactionPenalty);
  }

  private createReward(total: number, profit: number, risk: number, transaction: number): TradingReward {
    return {
      total,
      components: {
        profit,
        risk,
        transaction,
        drawdown: risk
      }
    };
  }

  private updatePerformanceMetrics(): void {
    // Update trades count
    this.state.tradesCount = this.trades.length;

    // Calculate win rate
    const completedTrades = this.trades.filter(t => t.pnl !== 0);
    const winningTrades = completedTrades.filter(t => t.pnl > 0);
    this.state.winRate = completedTrades.length > 0 ? winningTrades.length / completedTrades.length : 0;

    // Calculate max drawdown
    this.state.maxDrawdown = this.maxEquity > 0 ? (this.maxEquity - this.state.equity) / this.maxEquity : 0;

    // Calculate Sharpe ratio (simplified)
    if (this.portfolioHistory.length > 10) {
      const returns = this.portfolioHistory.slice(-10).map((val, i, arr) =>
        i > 0 ? (val - arr[i-1]) / arr[i-1] : 0
      ).slice(1);

      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const returnStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      this.state.sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;
    }

    // Calculate exposure ratio
    this.state.exposureRatio = Math.abs(this.state.position) / this.maxPosition;
  }

  getState(): TradingState {
    return { ...this.state };
  }

  getStateVector(): number[] {
    // Convert state to numerical vector for RL agent
    return [
      this.state.price / 10000, // Normalize price
      this.state.volume / 1000000, // Normalize volume
      this.state.volatility,
      this.state.rsi / 100,
      this.state.macd,
      this.state.position / this.maxPosition,
      this.state.balance / this.initialBalance,
      this.state.equity / this.initialBalance,
      this.state.unrealizedPnL / this.initialBalance,
      this.state.maxDrawdown,
      this.state.sharpeRatio,
      this.state.exposureRatio
    ];
  }

  getActionSpace(): number {
    return 3; // sell/short, hold, buy/long
  }

  getStateSpace(): number {
    return this.getStateVector().length;
  }
}

// --- Q-Learning Agent ---
export class QLearningAgent {
  private qTable: Map<string, number[]> = new Map();
  private learningRate: number;
  private discountFactor: number;
  private epsilon: number;
  private epsilonDecay: number;
  private minEpsilon: number;
  private actionSpace: number;
  private stateSpace: number;

  constructor(
    stateSpace: number,
    actionSpace: number,
    learningRate: number = 0.1,
    discountFactor: number = 0.95,
    epsilon: number = 1.0,
    epsilonDecay: number = 0.995,
    minEpsilon: number = 0.01
  ) {
    this.stateSpace = stateSpace;
    this.actionSpace = actionSpace;
    this.learningRate = learningRate;
    this.discountFactor = discountFactor;
    this.epsilon = epsilon;
    this.epsilonDecay = epsilonDecay;
    this.minEpsilon = minEpsilon;
  }

  private stateToString(state: number[]): string {
    // Discretize continuous state space for Q-table
    return state.map(s => Math.round(s * 100) / 100).join(',');
  }

  private getQValues(state: number[]): number[] {
    const stateKey = this.stateToString(state);
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Array(this.actionSpace).fill(0));
    }
    return this.qTable.get(stateKey)!;
  }

  selectAction(state: number[]): TradingAction {
    // Epsilon-greedy action selection
    if (Math.random() < this.epsilon) {
      // Random action (exploration)
      return Math.floor(Math.random() * this.actionSpace) as TradingAction;
    } else {
      // Greedy action (exploitation)
      const qValues = this.getQValues(state);
      const maxQ = Math.max(...qValues);
      const bestActions = qValues.map((q, i) => q === maxQ ? i : -1).filter(i => i !== -1);
      return bestActions[Math.floor(Math.random() * bestActions.length)] as TradingAction;
    }
  }

  updateQValue(
    state: number[],
    action: TradingAction,
    reward: number,
    nextState: number[],
    done: boolean
  ): void {
    const stateKey = this.stateToString(state);
    const qValues = this.getQValues(state);

    let maxNextQ = 0;
    if (!done) {
      const nextQValues = this.getQValues(nextState);
      maxNextQ = Math.max(...nextQValues);
    }

    // Q-learning update rule: Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
    const currentQ = qValues[action];
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);

    qValues[action] = newQ;
    this.qTable.set(stateKey, qValues);
  }

  decayEpsilon(): void {
    this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
  }

  getEpsilon(): number {
    return this.epsilon;
  }

  getQTableSize(): number {
    return this.qTable.size;
  }

  saveModel(): string {
    // Convert Q-table to JSON for persistence
    const qTableObj: { [key: string]: number[] } = {};
    this.qTable.forEach((value, key) => {
      qTableObj[key] = value;
    });

    return JSON.stringify({
      qTable: qTableObj,
      learningRate: this.learningRate,
      discountFactor: this.discountFactor,
      epsilon: this.epsilon,
      epsilonDecay: this.epsilonDecay,
      minEpsilon: this.minEpsilon,
      actionSpace: this.actionSpace,
      stateSpace: this.stateSpace
    });
  }

  loadModel(modelData: string): void {
    const data = JSON.parse(modelData);

    this.qTable.clear();
    Object.entries(data.qTable).forEach(([key, value]) => {
      this.qTable.set(key, value as number[]);
    });

    this.learningRate = data.learningRate;
    this.discountFactor = data.discountFactor;
    this.epsilon = data.epsilon;
    this.epsilonDecay = data.epsilonDecay;
    this.minEpsilon = data.minEpsilon;
    this.actionSpace = data.actionSpace;
    this.stateSpace = data.stateSpace;
  }
}

// --- RL Trading System ---
export class RLTradingSystem {
  private environment: TradingRLEnvironment;
  private agent: QLearningAgent;
  private trainingHistory: Array<{
    episode: number;
    totalReward: number;
    finalEquity: number;
    trades: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
  }> = [];

  constructor(data: MarketData[], initialBalance: number = 10000) {
    this.environment = new TradingRLEnvironment(data, initialBalance);
    this.agent = new QLearningAgent(
      this.environment.getStateSpace(),
      this.environment.getActionSpace()
    );
  }

  train(episodes: number = 1000, verbose: boolean = false): void {
    for (let episode = 0; episode < episodes; episode++) {
      let state = this.environment.reset();
      let stateVector = this.environment.getStateVector();
      let totalReward = 0;
      let done = false;

      while (!done) {
        const action = this.agent.selectAction(stateVector);
        const { nextState, reward, done: episodeDone } = this.environment.step(action);
        const nextStateVector = this.environment.getStateVector();

        this.agent.updateQValue(stateVector, action, reward.total, nextStateVector, episodeDone);

        totalReward += reward.total;
        state = nextState;
        stateVector = nextStateVector;
        done = episodeDone;
      }

      this.agent.decayEpsilon();

      // Record training history
      this.trainingHistory.push({
        episode,
        totalReward,
        finalEquity: state.equity,
        trades: state.tradesCount,
        winRate: state.winRate,
        maxDrawdown: state.maxDrawdown,
        sharpeRatio: state.sharpeRatio
      });

      if (verbose && episode % 100 === 0) {
        console.log(`Episode ${episode}: Reward=${totalReward.toFixed(2)}, Equity=${state.equity.toFixed(2)}, Epsilon=${this.agent.getEpsilon().toFixed(3)}`);
      }
    }
  }

  predict(state: number[]): { action: TradingAction; confidence: number } {
    // Set epsilon to 0 for pure exploitation during prediction
    const originalEpsilon = this.agent.getEpsilon();
    (this.agent as any).epsilon = 0;

    const action = this.agent.selectAction(state);
    const qValues = (this.agent as any).getQValues(state);
    const maxQ = Math.max(...qValues);
    const confidence = Math.max(0, Math.min(1, (maxQ + 1) / 2)); // Normalize Q-value to confidence

    // Restore original epsilon
    (this.agent as any).epsilon = originalEpsilon;

    return { action, confidence };
  }

  getTrainingHistory(): typeof this.trainingHistory {
    return [...this.trainingHistory];
  }

  saveAgent(): string {
    return this.agent.saveModel();
  }

  loadAgent(modelData: string): void {
    this.agent.loadModel(modelData);
  }
}
    let reward = 0;
    // Simple reward: PnL from position
    if (action === 'buy') {
      this.state.position = 1;
    } else if (action === 'sell') {
      this.state.position = -1;
    } else {
      // hold
    }
    reward = (nextPrice - prevPrice) * this.state.position;
    this.state.price = nextPrice;
    this.state.step = this.currentStep;
    this.state.balance += reward;
    return { nextState: { ...this.state }, reward, done: false };
  }
}

// --- RL Agent Template (Q-learning) ---
export class QLearningAgent {
  private qTable: Map<string, number[]> = new Map();
  private actions: TradingAction[] = ['buy', 'sell', 'hold'];
  private alpha = 0.1;
  private gamma = 0.95;
  private epsilon = 0.1;

  getStateKey(state: TradingState): string {
    return `${state.price.toFixed(2)}_${state.position}_${state.balance.toFixed(2)}`;
  }

  selectAction(state: TradingState): TradingAction {
    if (Math.random() < this.epsilon) {
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    }
    const key = this.getStateKey(state);
    const qValues = this.qTable.get(key) || [0, 0, 0];
    const maxIdx = qValues.indexOf(Math.max(...qValues));
    return this.actions[maxIdx];
  }

  update(state: TradingState, action: TradingAction, reward: number, nextState: TradingState) {
    const key = this.getStateKey(state);
    const nextKey = this.getStateKey(nextState);
    const qValues = this.qTable.get(key) || [0, 0, 0];
    const nextQ = this.qTable.get(nextKey) || [0, 0, 0];
    const actionIdx = this.actions.indexOf(action);
    qValues[actionIdx] = qValues[actionIdx] + this.alpha * (reward + this.gamma * Math.max(...nextQ) - qValues[actionIdx]);
    this.qTable.set(key, qValues);
  }
}

// Add your own RL agents and environments below
