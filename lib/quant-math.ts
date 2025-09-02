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



export function tTest(arr1: number[], arr2: number[]): { t: number; p: number; significant: boolean } {



  const m1 = mean(arr1), m2 = mean(arr2);



  const v1 = variance(arr1), v2 = variance(arr2);



  const n1 = arr1.length, n2 = arr2.length;



  const pooledStd = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));



  const t = (m1 - m2) / (pooledStd * Math.sqrt(1/n1 + 1/n2));







  // Approximate p-value using t-distribution (simplified)



  const df = n1 + n2 - 2;



  const p = 2 * (1 - tCDF(Math.abs(t), df));







  return { t, p, significant: p < 0.05 };



<<<<<<<
}







// Simplified t-distribution CDF approximation



function tCDF(t: number, df: number): number {



  // Using normal approximation for large df



  if (df > 30) {



    return normalCDF(t);



  }



  // Simplified approximation for small df



  const x = t / Math.sqrt(df);



  return 0.5 + 0.5 * Math.sign(t) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI));



}







function normalCDF(x: number): number {



  return 0.5 * (1 + erf(x / Math.sqrt(2)));



}







function erf(x: number): number {



  // Abramowitz and Stegun approximation



  const a1 =  0.254829592;



  const a2 = -0.284496736;



  const a3 =  1.421413741;



  const a4 = -1.453152027;



  const a5 =  1.061405429;



  const p  =  0.3275911;







  const sign = x >= 0 ? 1 : -1;



  x = Math.abs(x);







  const t = 1.0 / (1.0 + p * x);



  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);







  return sign * y;



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



export function optimizePortfolio(expectedReturns: number[], covMatrix: number[][], riskAversion: number = 1): number[] {



  const n = expectedReturns.length;







  // Simplified mean-variance optimization using equal risk contribution



  // In practice, this would use quadratic programming



  const weights = new Array(n).fill(1 / n);







  // Risk parity adjustment



  const risks = weights.map((w, i) => w * Math.sqrt(covMatrix[i][i]));



  const totalRisk = risks.reduce((sum, r) => sum + r, 0);







  return weights.map((w, i) => w * (totalRisk / (n * risks[i])));



}







// --- Factor Models (Single Factor) ---



export function singleFactorModel(assetReturns: number[], factorReturns: number[]): { alpha: number; beta: number; rSquared: number } {



  const regression = olsRegression(factorReturns, assetReturns);



  const predicted = factorReturns.map(f => regression.alpha + regression.beta * f);



  const residuals = assetReturns.map((actual, i) => actual - predicted[i]);







  const totalSumSquares = variance(assetReturns) * (assetReturns.length - 1);



  const residualSumSquares = residuals.reduce((sum, r) => sum + r * r, 0);



  const rSquared = 1 - (residualSumSquares / totalSumSquares);







  return { ...regression, rSquared };



}







// --- Technical Indicators ---



export function sma(prices: number[], period: number): number[] {



  const result: number[] = [];



  for (let i = period - 1; i < prices.length; i++) {



    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);



    result.push(sum / period);



  }



  return result;



}







export function ema(prices: number[], period: number): number[] {



  const multiplier = 2 / (period + 1);



  const result: number[] = [prices[0]];







  for (let i = 1; i < prices.length; i++) {



    result.push((prices[i] * multiplier) + (result[i - 1] * (1 - multiplier)));



  }



  return result;



}







export function rsi(prices: number[], period: number = 14): number[] {



  const changes = prices.slice(1).map((price, i) => price - prices[i]);



  const gains = changes.map(change => change > 0 ? change : 0);



  const losses = changes.map(change => change < 0 ? -change : 0);







  const avgGains = sma(gains, period);



  const avgLosses = sma(losses, period);







  return avgGains.map((avgGain, i) => {



    const rs = avgGain / avgLosses[i];



    return 100 - (100 / (1 + rs));



  });



}







export function bollinger(prices: number[], period: number = 20, stdMultiplier: number = 2): { upper: number[], middle: number[], lower: number[] } {



  const middle = sma(prices, period);



  const result = { upper: [] as number[], middle, lower: [] as number[] };







  for (let i = period - 1; i < prices.length; i++) {



    const slice = prices.slice(i - period + 1, i + 1);



    const std = stddev(slice);



    const smaValue = middle[i - period + 1];







    result.upper.push(smaValue + (std * stdMultiplier));



    result.lower.push(smaValue - (std * stdMultiplier));



  }







  return result;



}







// --- Advanced Risk Metrics ---



export function conditionalVaR(returns: number[], confidence: number = 0.95): number {



  const sorted = [...returns].sort((a, b) => a - b);



  const cutoff = Math.floor((1 - confidence) * sorted.length);



  const tailReturns = sorted.slice(0, cutoff);



  return Math.abs(mean(tailReturns));



}







export function sortinoRatio(returns: number[], targetReturn: number = 0): number {



  const excessReturns = returns.map(r => r - targetReturn);



  const downside = excessReturns.filter(r => r < 0);



  const downsideDeviation = Math.sqrt(mean(downside.map(r => r * r)));



  return mean(excessReturns) / downsideDeviation;



}







export function calmarRatio(returns: number[], prices: number[]): number {



  const annualizedReturn = mean(returns) * 252; // Assuming daily returns



  const maxDD = maxDrawdown(prices);



  return annualizedReturn / maxDD;



}



=======
export function calmarRatio(returns: number[], prices: number[]): number {

  const annualizedReturn = mean(returns) * 252; // Assuming daily returns

  const maxDD = maxDrawdown(prices);

  return annualizedReturn / maxDD;

}



// MACD (Moving Average Convergence Divergence)

export function macd(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {

  macd: number[];

  signal: number[];

  histogram: number[];

} {

  const fastEMA = ema(prices, fastPeriod);

  const slowEMA = ema(prices, slowPeriod);



  const macdLine: number[] = [];

  const startIndex = Math.max(fastPeriod, slowPeriod) - 1;



  for (let i = startIndex; i < prices.length; i++) {

    const fastIndex = i - (slowPeriod - fastPeriod);

    if (fastIndex >= 0 && i < slowEMA.length && fastIndex < fastEMA.length) {

      macdLine.push(fastEMA[fastIndex] - slowEMA[i]);

    }

  }



  const signalLine = ema(macdLine, signalPeriod);

  const histogram: number[] = [];



  for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {

    histogram.push(macdLine[i] - signalLine[i]);

  }



  return {

    macd: macdLine,

    signal: signalLine,

    histogram: histogram

  };

}



// Stochastic Oscillator

export function stochastic(highs: number[], lows: number[], closes: number[], kPeriod: number = 14, dPeriod: number = 3): number[] {

  const kValues: number[] = [];



  for (let i = kPeriod - 1; i < closes.length; i++) {

    const periodHighs = highs.slice(i - kPeriod + 1, i + 1);

    const periodLows = lows.slice(i - kPeriod + 1, i + 1);



    const highestHigh = Math.max(...periodHighs);

    const lowestLow = Math.min(...periodLows);



    const kValue = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;

    kValues.push(kValue);

  }



  // Apply D period smoothing

  return sma(kValues, dPeriod);

}



// Average True Range

export function atr(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {

  const trueRanges: number[] = [];



  for (let i = 1; i < closes.length; i++) {

    const tr1 = highs[i] - lows[i];

    const tr2 = Math.abs(highs[i] - closes[i - 1]);

    const tr3 = Math.abs(lows[i] - closes[i - 1]);



    trueRanges.push(Math.max(tr1, tr2, tr3));

  }



  return sma(trueRanges, period);

}

>>>>>>>
