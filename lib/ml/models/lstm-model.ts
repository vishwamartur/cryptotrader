// Dynamic import for TensorFlow.js to avoid build issues
let tf: any = null;

// Initialize TensorFlow.js dynamically
const initTensorFlow = async () => {
  if (typeof window !== 'undefined' && !tf) {
    try {
      tf = await import('@tensorflow/tfjs');
    } catch (error) {
      console.warn('TensorFlow.js not available, using mock implementation');
    }
  }
};

import { MLModelService } from '../services/ml-model-service';
import { FeatureEngineeringService } from '../services/feature-engineering-service';
import { MarketDataService } from '../../database/services/market-data-service';

export interface LSTMConfig {
  sequenceLength: number;
  features: string[];
  hiddenUnits: number[];
  dropout: number;
  learningRate: number;
  batchSize: number;
  epochs: number;
  validationSplit: number;
  predictionHorizon: number; // hours ahead to predict
}

export interface LSTMPrediction {
  symbol: string;
  predictedPrice: number;
  predictedDirection: 'up' | 'down' | 'sideways';
  confidence: number;
  predictionTime: Date;
  targetTime: Date;
  features: any;
}

export class LSTMModel {
  private model: any = null;
  private config: LSTMConfig;
  private scaler: { mean: number[]; std: number[] } | null = null;
  private featureNames: string[] = [];

  constructor(config: LSTMConfig) {
    // Initialize TensorFlow.js when creating model
    initTensorFlow();
    const defaultConfig = {
      sequenceLength: 24, // 24 hours of data
      features: [
        'price', 'volume', 'sma_5', 'sma_20', 'rsi_14', 'macd',
        'bb_upper', 'bb_lower', 'atr_14', 'price_momentum_1h'
      ],
      hiddenUnits: [50, 30],
      dropout: 0.2,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 100,
      validationSplit: 0.2,
      predictionHorizon: 1,
    };

    this.config = { ...defaultConfig, ...config };
  }

  // Build LSTM model architecture
  private buildModel(inputShape: number[]): any {
    if (!tf) {
      throw new Error('TensorFlow.js not initialized');
    }
    const model = tf.sequential();

    // First LSTM layer
    model.add(tf.layers.lstm({
      units: this.config.hiddenUnits[0],
      returnSequences: this.config.hiddenUnits.length > 1,
      inputShape: inputShape,
      dropout: this.config.dropout,
      recurrentDropout: this.config.dropout,
    }));

    // Additional LSTM layers
    for (let i = 1; i < this.config.hiddenUnits.length; i++) {
      model.add(tf.layers.lstm({
        units: this.config.hiddenUnits[i],
        returnSequences: i < this.config.hiddenUnits.length - 1,
        dropout: this.config.dropout,
        recurrentDropout: this.config.dropout,
      }));
    }

    // Dense layers for prediction
    model.add(tf.layers.dense({ units: 20, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: this.config.dropout }));
    model.add(tf.layers.dense({ units: 1, activation: 'linear' })); // Price prediction

    // Compile model
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'meanSquaredError',
      metrics: ['mae', 'mse'],
    });

    return model;
  }

  // Prepare training data
  private async prepareTrainingData(symbol: string, days: number = 30): Promise<{
    X: tf.Tensor3D;
    y: tf.Tensor2D;
    scaler: { mean: number[]; std: number[] };
  }> {
    // Get historical market data
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const marketData = await MarketDataService.getHistoricalData(symbol, startTime, endTime, days * 24);
    
    if (marketData.length < this.config.sequenceLength + this.config.predictionHorizon) {
      throw new Error(`Insufficient data: need at least ${this.config.sequenceLength + this.config.predictionHorizon} points`);
    }

    // Create feature matrix
    const features: number[][] = [];
    const targets: number[] = [];

    for (let i = 0; i < marketData.length - this.config.predictionHorizon; i++) {
      const dataPoint = marketData[i];
      const targetPoint = marketData[i + this.config.predictionHorizon];
      
      // Extract features (simplified - in production would use FeatureEngineeringService)
      const featureVector = [
        Number(dataPoint.price),
        Number(dataPoint.volume),
        Number(dataPoint.change),
        Number(dataPoint.changePercent),
        Number(dataPoint.high24h || dataPoint.price),
        Number(dataPoint.low24h || dataPoint.price),
      ];

      features.push(featureVector);
      targets.push(Number(targetPoint.price));
    }

    // Normalize features
    const scaler = this.calculateScaler(features);
    const normalizedFeatures = this.normalizeData(features, scaler);

    // Create sequences
    const sequences: number[][][] = [];
    const sequenceTargets: number[] = [];

    for (let i = 0; i <= normalizedFeatures.length - this.config.sequenceLength; i++) {
      sequences.push(normalizedFeatures.slice(i, i + this.config.sequenceLength));
      sequenceTargets.push(targets[i + this.config.sequenceLength - 1]);
    }

    // Convert to tensors
    const X = tf.tensor3d(sequences);
    const y = tf.tensor2d(sequenceTargets, [sequenceTargets.length, 1]);

    return { X, y, scaler };
  }

  // Calculate data scaler (mean and std)
  private calculateScaler(data: number[][]): { mean: number[]; std: number[] } {
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
      if (std[i] === 0) std[i] = 1; // Avoid division by zero
    }

    return { mean, std };
  }

  // Normalize data using scaler
  private normalizeData(data: number[][], scaler: { mean: number[]; std: number[] }): number[][] {
    return data.map(row => 
      row.map((value, i) => (value - scaler.mean[i]) / scaler.std[i])
    );
  }

  // Denormalize predictions
  private denormalizePrediction(normalizedValue: number, featureIndex: number = 0): number {
    if (!this.scaler) return normalizedValue;
    return (normalizedValue * this.scaler.std[featureIndex]) + this.scaler.mean[featureIndex];
  }

  // Train the LSTM model
  async train(symbol: string, days: number = 30): Promise<{
    modelId: string;
    trainingHistory: any;
    performance: any;
  }> {
    console.log(`Training LSTM model for ${symbol}...`);

    // Initialize TensorFlow.js if not already done
    await initTensorFlow();
    if (!tf) {
      throw new Error('TensorFlow.js is not available. Training requires TensorFlow.js.');
    }

    // Prepare training data
    const { X, y, scaler } = await this.prepareTrainingData(symbol, days);
    this.scaler = scaler;

    // Build model
    const inputShape = [this.config.sequenceLength, X.shape[2]];
    this.model = this.buildModel(inputShape);

    console.log('Model architecture:');
    this.model.summary();

    // Train model
    const history = await this.model.fit(X, y, {
      epochs: this.config.epochs,
      batchSize: this.config.batchSize,
      validationSplit: this.config.validationSplit,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, val_loss = ${logs?.val_loss?.toFixed(4)}`);
          }
        }
      }
    });

    // Evaluate model performance
    const evaluation = this.model.evaluate(X, y) as tf.Scalar[];
    const loss = await evaluation[0].data();
    const mae = await evaluation[1].data();
    const mse = await evaluation[2].data();

    const performance = {
      loss: loss[0],
      mae: mae[0],
      mse: mse[0],
      rmse: Math.sqrt(mse[0]),
    };

    // Save model to database
    const modelData = {
      name: `LSTM_${symbol}_${Date.now()}`,
      type: 'lstm',
      version: '1.0.0',
      description: `LSTM model for ${symbol} price prediction`,
      parameters: this.config,
      architecture: {
        inputShape,
        layers: this.config.hiddenUnits,
        features: this.config.features,
      },
      performance: {
        ...performance,
        trainingDays: days,
        dataPoints: X.shape[0],
      },
      status: 'active',
      accuracy: Math.max(0, 1 - performance.mae / 1000), // Simplified accuracy calculation
      lastTrainedAt: new Date(),
    };

    const model = await MLModelService.createModel(modelData);

    // Clean up tensors
    X.dispose();
    y.dispose();
    evaluation.forEach(tensor => tensor.dispose());

    console.log(`LSTM model training completed. Model ID: ${model.id}`);

    return {
      modelId: model.id,
      trainingHistory: history.history,
      performance,
    };
  }

  // Make prediction
  async predict(symbol: string, currentTime: Date = new Date()): Promise<LSTMPrediction> {
    if (!this.model || !this.scaler) {
      throw new Error('Model not trained. Call train() first.');
    }

    // Get recent data for prediction
    const endTime = currentTime;
    const startTime = new Date(endTime.getTime() - (this.config.sequenceLength * 60 * 60 * 1000));
    
    const recentData = await MarketDataService.getHistoricalData(symbol, startTime, endTime, this.config.sequenceLength);
    
    if (recentData.length < this.config.sequenceLength) {
      throw new Error(`Insufficient recent data for prediction: ${recentData.length} points`);
    }

    // Prepare input features
    const features: number[][] = [];
    for (const dataPoint of recentData.slice(-this.config.sequenceLength)) {
      const featureVector = [
        Number(dataPoint.price),
        Number(dataPoint.volume),
        Number(dataPoint.change),
        Number(dataPoint.changePercent),
        Number(dataPoint.high24h || dataPoint.price),
        Number(dataPoint.low24h || dataPoint.price),
      ];
      features.push(featureVector);
    }

    // Normalize features
    const normalizedFeatures = this.normalizeData(features, this.scaler);

    // Create input tensor
    const inputTensor = tf.tensor3d([normalizedFeatures]);

    // Make prediction
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const predictionData = await prediction.data();
    const normalizedPrediction = predictionData[0];

    // Denormalize prediction
    const predictedPrice = this.denormalizePrediction(normalizedPrediction, 0);
    const currentPrice = Number(recentData[recentData.length - 1].price);
    
    // Determine direction and confidence
    const priceChange = predictedPrice - currentPrice;
    const priceChangePercent = (priceChange / currentPrice) * 100;
    
    let direction: 'up' | 'down' | 'sideways';
    let confidence: number;
    
    if (Math.abs(priceChangePercent) < 0.5) {
      direction = 'sideways';
      confidence = 0.6;
    } else if (priceChangePercent > 0) {
      direction = 'up';
      confidence = Math.min(0.95, 0.5 + Math.abs(priceChangePercent) / 10);
    } else {
      direction = 'down';
      confidence = Math.min(0.95, 0.5 + Math.abs(priceChangePercent) / 10);
    }

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    const targetTime = new Date(currentTime.getTime() + (this.config.predictionHorizon * 60 * 60 * 1000));

    return {
      symbol,
      predictedPrice,
      predictedDirection: direction,
      confidence,
      predictionTime: currentTime,
      targetTime,
      features: {
        currentPrice,
        priceChange,
        priceChangePercent,
        sequenceLength: this.config.sequenceLength,
        predictionHorizon: this.config.predictionHorizon,
      },
    };
  }

  // Load model from saved state
  async loadModel(modelPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${modelPath}`);
      console.log('LSTM model loaded successfully');
    } catch (error) {
      console.error('Failed to load LSTM model:', error);
      throw error;
    }
  }

  // Save model to file
  async saveModel(modelPath: string): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save. Train a model first.');
    }

    try {
      await this.model.save(`file://${modelPath}`);
      console.log(`LSTM model saved to ${modelPath}`);
    } catch (error) {
      console.error('Failed to save LSTM model:', error);
      throw error;
    }
  }

  // Get model summary
  getModelSummary(): any {
    if (!this.model) {
      return null;
    }

    return {
      config: this.config,
      architecture: {
        layers: this.model.layers.length,
        parameters: this.model.countParams(),
        inputShape: this.model.inputShape,
        outputShape: this.model.outputShape,
      },
      scaler: this.scaler,
    };
  }

  // Dispose model and free memory
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.scaler = null;
  }

  // Validate model performance
  async validateModel(symbol: string, validationDays: number = 7): Promise<{
    accuracy: number;
    mae: number;
    mse: number;
    directionalAccuracy: number;
  }> {
    if (!this.model || !this.scaler) {
      throw new Error('Model not trained. Call train() first.');
    }

    // Get validation data
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (validationDays * 24 * 60 * 60 * 1000));
    
    const validationData = await MarketDataService.getHistoricalData(symbol, startTime, endTime, validationDays * 24);
    
    if (validationData.length < this.config.sequenceLength + this.config.predictionHorizon) {
      throw new Error('Insufficient validation data');
    }

    let totalError = 0;
    let totalSquaredError = 0;
    let correctDirections = 0;
    let totalPredictions = 0;

    // Make predictions on validation data
    for (let i = this.config.sequenceLength; i < validationData.length - this.config.predictionHorizon; i++) {
      const inputData = validationData.slice(i - this.config.sequenceLength, i);
      const actualPrice = Number(validationData[i + this.config.predictionHorizon].price);
      const currentPrice = Number(validationData[i].price);

      // Prepare features and make prediction
      const features: number[][] = [];
      for (const dataPoint of inputData) {
        const featureVector = [
          Number(dataPoint.price),
          Number(dataPoint.volume),
          Number(dataPoint.change),
          Number(dataPoint.changePercent),
          Number(dataPoint.high24h || dataPoint.price),
          Number(dataPoint.low24h || dataPoint.price),
        ];
        features.push(featureVector);
      }

      const normalizedFeatures = this.normalizeData(features, this.scaler);
      const inputTensor = tf.tensor3d([normalizedFeatures]);
      
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();
      const predictedPrice = this.denormalizePrediction(predictionData[0], 0);

      // Calculate errors
      const error = Math.abs(predictedPrice - actualPrice);
      const squaredError = Math.pow(predictedPrice - actualPrice, 2);
      
      totalError += error;
      totalSquaredError += squaredError;

      // Check directional accuracy
      const predictedDirection = predictedPrice > currentPrice ? 1 : -1;
      const actualDirection = actualPrice > currentPrice ? 1 : -1;
      
      if (predictedDirection === actualDirection) {
        correctDirections++;
      }
      
      totalPredictions++;

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
    }

    const mae = totalError / totalPredictions;
    const mse = totalSquaredError / totalPredictions;
    const directionalAccuracy = correctDirections / totalPredictions;
    const accuracy = Math.max(0, 1 - mae / 1000); // Simplified accuracy

    return {
      accuracy,
      mae,
      mse,
      directionalAccuracy,
    };
  }
}
