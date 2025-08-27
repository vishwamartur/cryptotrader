// Quant RL Module: Reinforcement Learning for Trading
// Scaffold for RL environment and agent

import { MarketData } from './market-data-provider'

// --- RL Environment ---
export type TradingState = {
  price: number;
  position: number; // -1: short, 0: flat, 1: long
  balance: number;
  step: number;
};

export type TradingAction = 'buy' | 'sell' | 'hold';

export type TradingReward = number;

export class TradingRLEnvironment {
  private data: MarketData[];
  private state: TradingState;
  private currentStep: number = 0;

  constructor(data: MarketData[], initialBalance = 10000) {
    this.data = data;
    this.state = {
      price: data[0].price,
      position: 0,
      balance: initialBalance,
      step: 0,
    };
  }

  reset(): TradingState {
    this.currentStep = 0;
    this.state = {
      price: this.data[0].price,
      position: 0,
      balance: this.state.balance,
      step: 0,
    };
    return this.state;
  }

  step(action: TradingAction): { nextState: TradingState; reward: TradingReward; done: boolean } {
    this.currentStep++;
    if (this.currentStep >= this.data.length) {
      return { nextState: this.state, reward: 0, done: true };
    }
    const prevPrice = this.state.price;
    const nextPrice = this.data[this.currentStep].price;
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
