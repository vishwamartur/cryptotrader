#!/usr/bin/env node

/**
 * Test Script for Real-time Market Data API
 * Verifies that the API route works without server/client boundary violations
 */

const symbols = ['BTC-USD', 'ETH-USD', 'ADA-USD', 'SOL-USD', 'BTCUSDT', 'ETHUSDT'];
const baseUrl = 'http://localhost:3000';

async function testRealtimeAPI() {
  console.log('🧪 Testing Real-time Market Data API');
  console.log('=====================================\n');

  let successCount = 0;
  let errorCount = 0;

  for (const symbol of symbols) {
    try {
      console.log(`📊 Testing symbol: ${symbol}`);
      
      // Test basic ticker data
      const response = await fetch(`${baseUrl}/api/market/realtime/${symbol}`);
      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`   ✅ Success: ${data.data.source} data`);
        console.log(`   💰 Price: $${data.data.price}`);
        console.log(`   📈 Change: ${data.data.changePercent}%`);
        console.log(`   🔄 Source: ${data.data.source}`);
        successCount++;
      } else {
        console.log(`   ❌ Failed: ${data.message || 'Unknown error'}`);
        errorCount++;
      }

      // Test with orderbook
      const orderbookResponse = await fetch(`${baseUrl}/api/market/realtime/${symbol}?includeOrderbook=true`);
      const orderbookData = await orderbookResponse.json();

      if (orderbookResponse.ok && orderbookData.success) {
        const hasOrderbook = orderbookData.data.orderbook ? 'Yes' : 'No';
        console.log(`   📚 Orderbook: ${hasOrderbook}`);
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
      errorCount++;
      console.log('');
    }
  }

  console.log('📊 Test Results:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📈 Success Rate: ${((successCount / symbols.length) * 100).toFixed(1)}%`);

  if (errorCount === 0) {
    console.log('\n🎉 All tests passed! No server/client boundary violations detected.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
}

async function testServerHealth() {
  console.log('\n🏥 Testing Server Health');
  console.log('========================\n');

  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Server is healthy');
      console.log(`   Status: ${data.status}`);
      console.log(`   Timestamp: ${new Date(data.timestamp).toLocaleString()}`);
    } else {
      console.log('❌ Server health check failed');
    }
  } catch (error) {
    console.log(`💥 Server health check error: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting API Tests...\n');

  // Test server health first
  await testServerHealth();

  // Test real-time API
  await testRealtimeAPI();

  console.log('\n✨ Test completed!');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { 
      method: 'GET',
      timeout: 5000 
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Run the tests
checkServer().then(isRunning => {
  if (!isRunning) {
    console.log('❌ Server is not running at http://localhost:3000');
    console.log('   Please start the development server with: npm run dev');
    process.exit(1);
  }
  
  main().catch(error => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
  });
});
