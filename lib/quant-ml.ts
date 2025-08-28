// Quant ML Module: Prediction & Anomaly Detection
// Advanced ML models for trading signal generation and market prediction

import { MarketData } from './market-data-provider';
import { sma, ema, rsi, mean, stddev, correlation } from './quant-math';

// --- Advanced Feature Extraction ---
export interface TechnicalFeatures {
  price: number;
  volume: number;
  returns: number;
  volatility: number;
  sma_5: number;
  sma_20: number;
  ema_12: number;
  ema_26: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  bollinger_upper: number;
  bollinger_lower: number;
  volume_sma: number;
  price_momentum: number;
  volume_momentum: number;
}

export function extractAdvancedFeatures(data: MarketData[], lookback: number = 50): TechnicalFeatures[] {
  if (data.length < lookback) {
    throw new Error(`Insufficient data: need at least ${lookback} points`);
  }

  const features: TechnicalFeatures[] = [];
  const prices = data.map(d => d.price);
  const volumes = data.map(d => d.volume || 0);

  // Calculate technical indicators
  const sma5 = sma(prices, 5);
  const sma20 = sma(prices, 20);
  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const rsiValues = rsi(prices, 14);
  const volumeSma = sma(volumes, 20);

  // MACD calculation
  const macd = ema12.map((val, i) => i < ema26.length ? val - ema26[i] : 0);
  const macdSignal = ema(macd, 9);

  // Bollinger Bands (simplified)
  const bollinger = prices.map((price, i) => {
    if (i < 19) return { upper: price, lower: price };
    const slice = prices.slice(i - 19, i + 1);
    const avg = mean(slice);
    const std = stddev(slice);
    return {
      upper: avg + 2 * std,
      lower: avg - 2 * std
    };
  });

  for (let i = lookback; i < data.length; i++) {
    const currentPrice = prices[i];
    const prevPrice = prices[i - 1];
    const returns = (currentPrice - prevPrice) / prevPrice;

    // Calculate volatility (20-period rolling)
    const recentReturns = prices.slice(i - 19, i + 1).map((p, idx, arr) =>
      idx > 0 ? (p - arr[idx - 1]) / arr[idx - 1] : 0
    ).slice(1);
    const volatility = stddev(recentReturns);

    // Momentum indicators
    const priceMomentum = i >= 10 ? (currentPrice - prices[i - 10]) / prices[i - 10] : 0;
    const volumeMomentum = i >= 10 && volumes[i] > 0 && volumes[i - 10] > 0 ?
      (volumes[i] - volumes[i - 10]) / volumes[i - 10] : 0;

    features.push({
      price: currentPrice,
      volume: volumes[i],
      returns,
      volatility,
      sma_5: sma5[i - 4] || currentPrice,
      sma_20: sma20[i - 19] || currentPrice,
      ema_12: ema12[i] || currentPrice,
      ema_26: ema26[i] || currentPrice,
      rsi: rsiValues[i - 14] || 50,
      macd: macd[i] || 0,
      macd_signal: macdSignal[i - 8] || 0,
      bollinger_upper: bollinger[i].upper,
      bollinger_lower: bollinger[i].lower,
      volume_sma: volumeSma[i - 19] || volumes[i],
      price_momentum: priceMomentum,
      volume_momentum: volumeMomentum
    });
  }

  return features;
}

// --- Multiple Linear Regression ---
export class MultipleLinearRegression {
  private weights: number[] = [];
  private bias: number = 0;
  private trained: boolean = false;

  train(features: number[][], targets: number[], learningRate: number = 0.01, epochs: number = 1000): void {
    const numFeatures = features[0].length;
    const numSamples = features.length;

    // Initialize weights and bias
    this.weights = new Array(numFeatures).fill(0).map(() => Math.random() * 0.01);
    this.bias = 0;

    // Gradient descent training
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      const weightGradients = new Array(numFeatures).fill(0);
      let biasGradient = 0;

      for (let i = 0; i < numSamples; i++) {
        const prediction = this.predict(features[i]);
        const error = prediction - targets[i];
        totalLoss += error * error;

        // Calculate gradients
        for (let j = 0; j < numFeatures; j++) {
          weightGradients[j] += error * features[i][j];
        }
        biasGradient += error;
      }

      // Update weights and bias
      for (let j = 0; j < numFeatures; j++) {
        this.weights[j] -= learningRate * weightGradients[j] / numSamples;
      }
      this.bias -= learningRate * biasGradient / numSamples;

      // Early stopping if loss is very small
      if (totalLoss / numSamples < 1e-6) break;
    }

    this.trained = true;
  }

  predict(features: number[]): number {
    if (!this.trained) {
      throw new Error('Model must be trained before making predictions');
    }

    let prediction = this.bias;
    for (let i = 0; i < features.length; i++) {
      prediction += this.weights[i] * features[i];
    }
    return prediction;
  }

  getWeights(): { weights: number[], bias: number } {
    return { weights: [...this.weights], bias: this.bias };
  }
}

// --- Advanced Anomaly Detection ---
export interface AnomalyResult {
  index: number;
  value: number;
  score: number;
  isAnomaly: boolean;
}

export class AnomalyDetector {
  private windowSize: number;
  private threshold: number;

  constructor(windowSize: number = 20, threshold: number = 2.5) {
    this.windowSize = windowSize;
    this.threshold = threshold;
  }

  // Isolation Forest-inspired anomaly detection
  detectAnomalies(data: number[]): AnomalyResult[] {
    const results: AnomalyResult[] = [];

    for (let i = this.windowSize; i < data.length; i++) {
      const window = data.slice(i - this.windowSize, i);
      const currentValue = data[i];

      // Calculate multiple anomaly scores
      const zScore = this.calculateZScore(currentValue, window);
      const iqrScore = this.calculateIQRScore(currentValue, window);
      const mahalanobisScore = this.calculateMahalanobisScore(currentValue, window);

      // Combine scores (weighted average)
      const combinedScore = (zScore * 0.4 + iqrScore * 0.3 + mahalanobisScore * 0.3);
      const isAnomaly = Math.abs(combinedScore) > this.threshold;

      results.push({
        index: i,
        value: currentValue,
        score: combinedScore,
        isAnomaly
      });
    }

    return results;
  }

  private calculateZScore(value: number, window: number[]): number {
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    const std = Math.sqrt(window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length);
    return std > 0 ? (value - mean) / std : 0;
  }

  private calculateIQRScore(value: number, window: number[]): number {
    const sorted = [...window].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    if (iqr === 0) return 0;

    if (value < q1) return (q1 - value) / iqr;
    if (value > q3) return (value - q3) / iqr;
    return 0;
  }

  private calculateMahalanobisScore(value: number, window: number[]): number {
    // Simplified 1D Mahalanobis distance
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
    return variance > 0 ? Math.abs(value - mean) / Math.sqrt(variance) : 0;
  }
}

// --- Simple Neural Network Implementation ---
export class SimpleNeuralNetwork {
  private inputSize: number;
  private hiddenSize: number;
  private outputSize: number;
  private weightsInputHidden: number[][];
  private weightsHiddenOutput: number[][];
  private biasHidden: number[];
  private biasOutput: number[];
  private learningRate: number;

  constructor(inputSize: number, hiddenSize: number = 10, outputSize: number = 1, learningRate: number = 0.01) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.learningRate = learningRate;

    // Initialize weights and biases randomly
    this.weightsInputHidden = this.initializeMatrix(inputSize, hiddenSize);
    this.weightsHiddenOutput = this.initializeMatrix(hiddenSize, outputSize);
    this.biasHidden = new Array(hiddenSize).fill(0).map(() => Math.random() * 0.1 - 0.05);
    this.biasOutput = new Array(outputSize).fill(0).map(() => Math.random() * 0.1 - 0.05);
  }

  private initializeMatrix(rows: number, cols: number): number[][] {
    return Array(rows).fill(0).map(() =>
      Array(cols).fill(0).map(() => Math.random() * 0.2 - 0.1)
    );
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }

  private sigmoidDerivative(x: number): number {
    return x * (1 - x);
  }

  predict(input: number[]): number[] {
    // Forward pass
    const hidden = this.forwardLayer(input, this.weightsInputHidden, this.biasHidden);
    const output = this.forwardLayer(hidden, this.weightsHiddenOutput, this.biasOutput);
    return output;
  }

  private forwardLayer(input: number[], weights: number[][], bias: number[]): number[] {
    const output = new Array(weights[0].length).fill(0);

    for (let j = 0; j < weights[0].length; j++) {
      let sum = bias[j];
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * weights[i][j];
      }
      output[j] = this.sigmoid(sum);
    }

    return output;
  }

  train(inputs: number[][], targets: number[][], epochs: number = 1000): void {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;

      for (let sample = 0; sample < inputs.length; sample++) {
        const input = inputs[sample];
        const target = targets[sample];

        // Forward pass
        const hidden = this.forwardLayer(input, this.weightsInputHidden, this.biasHidden);
        const output = this.forwardLayer(hidden, this.weightsHiddenOutput, this.biasOutput);

        // Calculate error
        const outputError = target.map((t, i) => t - output[i]);
        totalError += outputError.reduce((sum, err) => sum + err * err, 0);

        // Backward pass
        this.backpropagate(input, hidden, output, outputError);
      }

      // Early stopping
      if (totalError / inputs.length < 1e-6) break;
    }
  }

  private backpropagate(input: number[], hidden: number[], output: number[], outputError: number[]): void {
    // Output layer gradients
    const outputGradients = output.map((o, i) => outputError[i] * this.sigmoidDerivative(o));

    // Hidden layer error
    const hiddenError = new Array(this.hiddenSize).fill(0);
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        hiddenError[i] += outputGradients[j] * this.weightsHiddenOutput[i][j];
      }
    }

    // Hidden layer gradients
    const hiddenGradients = hidden.map((h, i) => hiddenError[i] * this.sigmoidDerivative(h));

    // Update weights and biases
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < this.outputSize; j++) {
        this.weightsHiddenOutput[i][j] += this.learningRate * outputGradients[j] * hidden[i];
      }
    }

    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.weightsInputHidden[i][j] += this.learningRate * hiddenGradients[j] * input[i];
      }
    }

    // Update biases
    for (let i = 0; i < this.outputSize; i++) {
      this.biasOutput[i] += this.learningRate * outputGradients[i];
    }

    for (let i = 0; i < this.hiddenSize; i++) {
      this.biasHidden[i] += this.learningRate * hiddenGradients[i];
    }
  }
}

// --- Market Prediction Engine ---
export class MarketPredictor {
  private model: SimpleNeuralNetwork;
  private scaler: { mean: number[], std: number[] } | null = null;

  constructor(inputSize: number) {
    this.model = new SimpleNeuralNetwork(inputSize, Math.max(8, Math.floor(inputSize / 2)), 3); // 3 outputs: buy, sell, hold probabilities
  }

  prepareTrainingData(features: TechnicalFeatures[]): { inputs: number[][], targets: number[][] } {
    const inputs: number[][] = [];
    const targets: number[][] = [];

    for (let i = 0; i < features.length - 1; i++) {
      const currentFeatures = this.featuresToArray(features[i]);
      const nextPrice = features[i + 1].price;
      const currentPrice = features[i].price;
      const priceChange = (nextPrice - currentPrice) / currentPrice;

      inputs.push(currentFeatures);

      // Create target based on price movement
      if (priceChange > 0.01) { // 1% increase
        targets.push([1, 0, 0]); // Buy signal
      } else if (priceChange < -0.01) { // 1% decrease
        targets.push([0, 1, 0]); // Sell signal
      } else {
        targets.push([0, 0, 1]); // Hold signal
      }
    }

    return { inputs, targets };
  }

  private featuresToArray(features: TechnicalFeatures): number[] {
    return [
      features.returns,
      features.volatility,
      features.rsi / 100, // Normalize RSI
      features.macd,
      features.macd_signal,
      (features.price - features.bollinger_lower) / (features.bollinger_upper - features.bollinger_lower), // Bollinger position
      features.price_momentum,
      features.volume_momentum,
      features.volume / features.volume_sma // Volume ratio
    ];
  }

  train(features: TechnicalFeatures[], epochs: number = 1000): void {
    const { inputs, targets } = this.prepareTrainingData(features);

    // Normalize inputs
    this.scaler = this.calculateScaler(inputs);
    const normalizedInputs = this.normalizeData(inputs, this.scaler);

    this.model.train(normalizedInputs, targets, epochs);
  }

  predict(features: TechnicalFeatures): { buy: number, sell: number, hold: number, signal: 'buy' | 'sell' | 'hold' } {
    if (!this.scaler) {
      throw new Error('Model must be trained before making predictions');
    }

    const input = this.featuresToArray(features);
    const normalizedInput = this.normalizeData([input], this.scaler)[0];
    const prediction = this.model.predict(normalizedInput);

    const [buy, sell, hold] = prediction;
    const maxIndex = prediction.indexOf(Math.max(...prediction));
    const signal = maxIndex === 0 ? 'buy' : maxIndex === 1 ? 'sell' : 'hold';

    return { buy, sell, hold, signal };
  }

  private calculateScaler(data: number[][]): { mean: number[], std: number[] } {
    const numFeatures = data[0].length;
    const mean = new Array(numFeatures).fill(0);
    const std = new Array(numFeatures).fill(0);

    // Calculate mean
    for (const row of data) {
      for (let i = 0; i < numFeatures; i++) {
        mean[i] += row[i];
      }
    }
    for (let i = 0; i < numFeatures; i++) {
      mean[i] /= data.length;
    }

    // Calculate standard deviation
    for (const row of data) {
      for (let i = 0; i < numFeatures; i++) {
        std[i] += Math.pow(row[i] - mean[i], 2);
      }
    }
    for (let i = 0; i < numFeatures; i++) {
      std[i] = Math.sqrt(std[i] / data.length);
      if (std[i] === 0) std[i] = 1; // Prevent division by zero
    }

    return { mean, std };
  }

  private normalizeData(data: number[][], scaler: { mean: number[], std: number[] }): number[][] {
    return data.map(row =>
      row.map((value, i) => (value - scaler.mean[i]) / scaler.std[i])
    );
  }
}
