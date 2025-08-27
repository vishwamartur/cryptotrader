// Quant Math & Statistics Library
// Core mathematical/statistical tools for quant trading

// --- Probability & Distributions ---
export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function variance(arr: number[]): number {
  const m = mean(arr);
  return mean(arr.map(x => (x - m) ** 2));
}

export function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

export function covariance(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  return mean(x.map((xi, i) => (xi - mx) * (y[i] - my)));
}

export function correlation(x: number[], y: number[]): number {
  return covariance(x, y) / (stddev(x) * stddev(y));
}

// --- Hypothesis Testing (t-test) ---
export function tTest(arr1: number[], arr2: number[]): { t: number; p: number } {
  const m1 = mean(arr1), m2 = mean(arr2);
  const v1 = variance(arr1), v2 = variance(arr2);
  const n1 = arr1.length, n2 = arr2.length;
  const t = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);
  // p-value calculation omitted for brevity
  return { t, p: NaN };
}

// --- Time Series Analysis ---
export function autocorrelation(arr: number[], lag: number): number {
  const n = arr.length;
  if (lag >= n) return NaN;
  const arr1 = arr.slice(lag);
  const arr2 = arr.slice(0, n - lag);
  return correlation(arr1, arr2);
}

// --- Regression (OLS) ---
export function olsRegression(x: number[], y: number[]): { alpha: number; beta: number } {
  const beta = covariance(x, y) / variance(x);
  const alpha = mean(y) - beta * mean(x);
  return { alpha, beta };
}

// --- Risk & Volatility Metrics ---
export function sharpeRatio(returns: number[], riskFreeRate = 0): number {
  const excess = returns.map(r => r - riskFreeRate);
  return mean(excess) / stddev(excess);
}

export function valueAtRisk(returns: number[], confidence = 0.95): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return Math.abs(sorted[idx]);
}

export function maxDrawdown(prices: number[]): number {
  let maxPeak = prices[0], maxDD = 0;
  for (const p of prices) {
    if (p > maxPeak) maxPeak = p;
    const dd = (maxPeak - p) / maxPeak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// --- Portfolio Optimization (Mean-Variance) ---
export function optimizePortfolio(returns: number[][], covMatrix: number[][], targetReturn: number): number[] {
  // Placeholder: returns equal weights
  const n = returns.length;
  return Array(n).fill(1 / n);
}

// --- Factor Models (Single Factor) ---
export function singleFactorModel(assetReturns: number[], factorReturns: number[]): { alpha: number; beta: number } {
  return olsRegression(factorReturns, assetReturns);
}
