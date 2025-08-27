// Quant ML Module: Prediction & Anomaly Detection
// Extend with TensorFlow.js or other ML libraries for advanced models

import { MarketData } from './market-data-provider'

// --- Feature Extraction ---
export function extractFeatures(data: MarketData[]): number[][] {
  // Example: [price, volume, price change]
  return data.map((d, i) => [
    d.price,
    d.volume ?? 0,
    i > 0 ? d.price - data[i - 1].price : 0,
  ])
}

// --- Simple Linear Regression (for prediction) ---
export function linearRegressionPredict(features: number[][], targets: number[]): (input: number[]) => number {
  // Fit y = a + b*x (single feature)
  const n = features.length
  const x = features.map(f => f[0])
  const y = targets
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n
  const b = x.map((xi, i) => (xi - meanX) * (y[i] - meanY)).reduce((a, b) => a + b, 0) /
    x.map(xi => (xi - meanX) ** 2).reduce((a, b) => a + b, 0)
  const a = meanY - b * meanX
  return (input: number[]) => a + b * input[0]
}

// --- Simple Anomaly Detection (Z-score) ---
export function detectAnomalies(data: number[], threshold = 3): number[] {
  const mean = data.reduce((a, b) => a + b, 0) / data.length
  const std = Math.sqrt(data.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / data.length)
  return data.map((x, i) => Math.abs((x - mean) / std) > threshold ? i : -1).filter(i => i !== -1)
}

// --- ML Integration Points ---
// Example: TensorFlow.js model loading, prediction, etc.
// import * as tf from '@tensorflow/tfjs'
// export function tfPredict(features: number[][]) { ... }

// Add your own ML models and utilities below
