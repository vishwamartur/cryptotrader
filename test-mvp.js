#!/usr/bin/env node

/**
 * MVP Test Script
 * Tests the core functionality of the CryptoTrader platform
 */

const baseUrl = 'http://localhost:3000/api';

async function testAPI(endpoint, options = {}) {
  try {
    console.log(`\n🧪 Testing ${endpoint}...`);
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${endpoint} - SUCCESS`);
      if (options.showData) {
        console.log('   Response:', JSON.stringify(data, null, 2));
      }
      return data;
    } else {
      console.log(`❌ ${endpoint} - FAILED`);
      console.log('   Error:', data.message || data.error);
      return null;
    }
  } catch (error) {
    console.log(`❌ ${endpoint} - ERROR`);
    console.log('   Error:', error.message);
    return null;
  }
}

async function runMVPTests() {
  console.log('🚀 CryptoTrader MVP Test Suite');
  console.log('================================');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test 1: Market Data API
  totalTests++;
  const marketData = await testAPI('/market/realtime/BTC-USD');
  if (marketData && marketData.success) passedTests++;
  
  // Test 2: Strategies List API
  totalTests++;
  const strategies = await testAPI('/strategies/list');
  if (strategies && strategies.success) passedTests++;
  
  // Test 3: Portfolio Status API
  totalTests++;
  const portfolio = await testAPI('/portfolio/status');
  if (portfolio && portfolio.success) passedTests++;
  
  // Test 4: Risk Metrics API
  totalTests++;
  const riskMetrics = await testAPI('/risk/metrics', {
    method: 'POST',
    body: JSON.stringify({
      positions: [],
      balance: 10000
    })
  });
  if (riskMetrics && riskMetrics.success) passedTests++;
  
  // Test 5: Trade Validation API
  totalTests++;
  const tradeValidation = await testAPI('/risk/validate-trade', {
    method: 'POST',
    body: JSON.stringify({
      signal: 'BUY',
      symbol: 'BTC-USD',
      positionSize: 1000,
      positions: [],
      balance: 10000
    })
  });
  if (tradeValidation && tradeValidation.success) passedTests++;
  
  // Test 6: Strategy Execution API
  totalTests++;
  const strategyExecution = await testAPI('/strategies/execute', {
    method: 'POST',
    body: JSON.stringify({
      strategy: 'MovingAverageCrossover',
      data: {
        prices: [44000, 44500, 45000, 45200, 45100, 45300, 45150, 45400]
      }
    })
  });
  if (strategyExecution && strategyExecution.success) passedTests++;
  
  // Test 7: Backtesting API
  totalTests++;
  const backtest = await testAPI('/backtest/run', {
    method: 'POST',
    body: JSON.stringify({
      strategy: 'MovingAverageCrossover',
      data: Array.from({length: 100}, (_, i) => ({
        symbol: 'BTC-USD',
        price: 45000 + (Math.random() - 0.5) * 1000,
        volume: 1000000,
        timestamp: Date.now() - (100 - i) * 60000
      })),
      parameters: {
        transactionCost: 0.001,
        slippage: 0.0005,
        initialCapital: 10000
      }
    })
  });
  if (backtest && backtest.success) passedTests++;
  
  // Test 8: AI Analysis API (may fail without API key)
  totalTests++;
  console.log('\n🧪 Testing /ai/analyze... (may fail without API key)');
  const aiAnalysis = await testAPI('/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({
      marketData: marketData?.data ? [marketData.data] : [{
        symbol: 'BTC-USD',
        price: 45000,
        volume: 1000000,
        timestamp: Date.now()
      }],
      positions: [],
      balance: 10000
    })
  });
  if (aiAnalysis && aiAnalysis.success) {
    passedTests++;
    console.log('✅ AI Analysis working with API key');
  } else {
    console.log('⚠️  AI Analysis failed (likely missing API key - this is expected in demo mode)');
  }
  
  // Summary
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`);
  
  if (passedTests >= 6) {
    console.log('\n🎉 MVP is functional! Core APIs are working correctly.');
    console.log('   You can now test the web interface at http://localhost:3000');
  } else {
    console.log('\n⚠️  Some core APIs are not working. Check the server logs.');
  }
  
  console.log('\n🔗 Next Steps:');
  console.log('   1. Visit http://localhost:3000 for the main interface');
  console.log('   2. Visit http://localhost:3000/dashboard for the simple dashboard');
  console.log('   3. Add your Anthropic API key to .env.local for AI features');
  console.log('   4. Run "npm test" for comprehensive testing');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('✅ Development server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Development server is not running');
    console.log('   Please run "npm run dev" first');
    return false;
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runMVPTests();
  }
}

main().catch(console.error);
