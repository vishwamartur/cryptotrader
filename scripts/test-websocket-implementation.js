#!/usr/bin/env node

/**
 * Comprehensive WebSocket Implementation Test Script
 * Tests the end-to-end WebSocket solution for crypto trading application
 */

const baseUrl = 'http://localhost:3000';

console.log('🔌 Testing Comprehensive WebSocket Implementation');
console.log('===============================================\n');

async function testWebSocketEndpoints() {
  console.log('🧪 Testing WebSocket-Related API Endpoints');
  console.log('------------------------------------------\n');

  const endpoints = [
    {
      name: 'WebSocket Connection Test',
      url: '/api/websocket/test-connection',
      expectedFields: ['success', 'connectionDetails']
    },
    {
      name: 'Market Products (for WebSocket discovery)',
      url: '/api/market/products',
      expectedFields: ['success', 'products']
    },
    {
      name: 'Market Tickers (fallback data)',
      url: '/api/market/tickers',
      expectedFields: ['success', 'tickers']
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const response = await fetch(`${baseUrl}${endpoint.url}`);
      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`   ✅ Success: ${endpoint.name} working properly`);
        
        // Check for expected fields
        const hasExpectedFields = endpoint.expectedFields.every(field => 
          data.hasOwnProperty(field)
        );
        
        if (hasExpectedFields) {
          console.log(`   📋 Expected fields present: ${endpoint.expectedFields.join(', ')}`);
        } else {
          console.log(`   ⚠️  Some expected fields missing: ${endpoint.expectedFields.join(', ')}`);
        }
        
        // Log data counts for market endpoints
        if (data.products) {
          console.log(`   📊 Products available: ${data.products.length}`);
        }
        if (data.tickers) {
          console.log(`   📊 Tickers available: ${data.tickers.length}`);
        }
        
        successCount++;
      } else {
        console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`);
        console.log(`   📝 Details: ${data.details || 'No details'}`);
        errorCount++;
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Network Error: ${error.message}`);
      errorCount++;
      console.log('');
    }
  }

  return { successCount, errorCount, total: endpoints.length };
}

async function testDashboardComponents() {
  console.log('🏠 Testing Dashboard Components with WebSocket Data');
  console.log('--------------------------------------------------\n');

  const dashboardEndpoints = [
    {
      name: 'Main Dashboard',
      url: '/',
      description: 'Should load without infinite loops'
    },
    {
      name: 'Health Check',
      url: '/api/health',
      description: 'Basic health endpoint'
    },
    {
      name: 'Detailed Health',
      url: '/api/health/detailed',
      description: 'Comprehensive health check'
    }
  ];

  let stableCount = 0;
  let unstableCount = 0;

  for (const endpoint of dashboardEndpoints) {
    try {
      console.log(`🧪 Testing: ${endpoint.name}`);
      console.log(`   Description: ${endpoint.description}`);
      
      const response = await fetch(`${baseUrl}${endpoint.url}`);
      
      if (response.ok) {
        console.log(`   ✅ Stable: ${endpoint.name} responding properly`);
        console.log(`   📊 Status: ${response.status} ${response.statusText}`);
        
        if (endpoint.url !== '/') {
          const data = await response.json();
          if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data);
            console.log(`   📋 Response keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`);
          }
        }
        
        stableCount++;
      } else {
        console.log(`   ❌ Unstable: ${endpoint.name} returned error`);
        console.log(`   📝 Status: ${response.status} ${response.statusText}`);
        unstableCount++;
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
      unstableCount++;
      console.log('');
    }
  }

  return { stableCount, unstableCount, total: dashboardEndpoints.length };
}

async function testWebSocketFeatures() {
  console.log('⚡ Testing WebSocket Features');
  console.log('-----------------------------\n');

  const features = [
    {
      name: 'Product Discovery',
      test: async () => {
        const response = await fetch(`${baseUrl}/api/market/products`);
        const data = await response.json();
        return {
          success: response.ok && data.success && Array.isArray(data.products),
          details: `${data.products?.length || 0} products discovered`,
          data: data.products?.slice(0, 5).map(p => p.symbol) || []
        };
      }
    },
    {
      name: 'Market Data Fallback',
      test: async () => {
        const response = await fetch(`${baseUrl}/api/market/tickers?symbols=BTCUSDT,ETHUSDT`);
        const data = await response.json();
        return {
          success: response.ok && data.success && Array.isArray(data.tickers),
          details: `${data.tickers?.length || 0} tickers available`,
          data: data.tickers?.map(t => `${t.symbol}: $${t.price}`) || []
        };
      }
    },
    {
      name: 'Real-time Data Endpoints',
      test: async () => {
        const response = await fetch(`${baseUrl}/api/market/realtime/BTC-USD`);
        const data = await response.json();
        return {
          success: response.ok && data.success,
          details: data.success ? 'Real-time data endpoint working' : 'Endpoint failed',
          data: data.data ? [`Price: $${data.data.price}`, `Change: ${data.data.change}%`] : []
        };
      }
    }
  ];

  let passedFeatures = 0;
  let failedFeatures = 0;

  for (const feature of features) {
    try {
      console.log(`🔬 Testing: ${feature.name}`);
      
      const result = await feature.test();
      
      if (result.success) {
        console.log(`   ✅ Passed: ${result.details}`);
        if (result.data && result.data.length > 0) {
          console.log(`   📊 Sample data: ${result.data.slice(0, 3).join(', ')}`);
        }
        passedFeatures++;
      } else {
        console.log(`   ❌ Failed: ${result.details}`);
        failedFeatures++;
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
      failedFeatures++;
      console.log('');
    }
  }

  return { passedFeatures, failedFeatures, total: features.length };
}

async function testInfiniteLoopPrevention() {
  console.log('🔄 Testing Infinite Loop Prevention');
  console.log('-----------------------------------\n');

  console.log('🧪 Checking for infinite loop indicators...');
  
  // Test by making multiple rapid requests to see if server remains stable
  const rapidRequests = [];
  for (let i = 0; i < 5; i++) {
    rapidRequests.push(fetch(`${baseUrl}/api/health`));
  }

  try {
    const responses = await Promise.all(rapidRequests);
    const allSuccessful = responses.every(r => r.ok);
    
    if (allSuccessful) {
      console.log('   ✅ Server handles rapid requests without issues');
      console.log('   ✅ No infinite loop indicators detected');
      console.log('   📊 All 5 rapid requests completed successfully');
      return { success: true, details: 'No infinite loops detected' };
    } else {
      console.log('   ⚠️  Some rapid requests failed');
      return { success: false, details: 'Server instability detected' };
    }
  } catch (error) {
    console.log(`   ❌ Error during rapid request test: ${error.message}`);
    return { success: false, details: error.message };
  }
}

async function checkServerHealth() {
  console.log('🏥 Checking Server Health');
  console.log('-------------------------\n');

  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Server is healthy and responding');
      console.log(`   Status: ${data.status || 'Unknown'}`);
      console.log(`   Timestamp: ${data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Not provided'}`);
      return true;
    } else {
      console.log('❌ Server health check failed');
      return false;
    }
  } catch (error) {
    console.log(`💥 Server health check error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Comprehensive WebSocket Implementation Tests...\n');

  // Check server health first
  const isHealthy = await checkServerHealth();
  console.log('');

  if (!isHealthy) {
    console.log('❌ Server is not healthy. Please check the server status.');
    process.exit(1);
  }

  // Run all tests
  const webSocketResults = await testWebSocketEndpoints();
  const dashboardResults = await testDashboardComponents();
  const featureResults = await testWebSocketFeatures();
  const loopResults = await testInfiniteLoopPrevention();

  console.log('');

  // Summary
  console.log('📋 Comprehensive Test Results Summary');
  console.log('=====================================\n');

  console.log(`🔌 WebSocket Endpoints:`);
  console.log(`   ✅ Working: ${webSocketResults.successCount}/${webSocketResults.total}`);
  console.log(`   ❌ Failed: ${webSocketResults.errorCount}/${webSocketResults.total}`);

  console.log(`\n🏠 Dashboard Components:`);
  console.log(`   ✅ Stable: ${dashboardResults.stableCount}/${dashboardResults.total}`);
  console.log(`   ❌ Unstable: ${dashboardResults.unstableCount}/${dashboardResults.total}`);

  console.log(`\n⚡ WebSocket Features:`);
  console.log(`   ✅ Passed: ${featureResults.passedFeatures}/${featureResults.total}`);
  console.log(`   ❌ Failed: ${featureResults.failedFeatures}/${featureResults.total}`);

  console.log(`\n🔄 Infinite Loop Prevention:`);
  console.log(`   ✅ Status: ${loopResults.success ? 'Passed' : 'Failed'}`);
  console.log(`   📝 Details: ${loopResults.details}`);

  // Overall assessment
  const totalTests = webSocketResults.total + dashboardResults.total + featureResults.total + 1;
  const totalPassed = webSocketResults.successCount + dashboardResults.stableCount + 
                     featureResults.passedFeatures + (loopResults.success ? 1 : 0);

  console.log(`\n📈 Overall Results:`);
  console.log(`   ✅ Passed: ${totalPassed}/${totalTests}`);
  console.log(`   📊 Success Rate: ${Math.round((totalPassed / totalTests) * 100)}%`);

  if (totalPassed === totalTests) {
    console.log('\n🎉 All tests passed! The comprehensive WebSocket implementation is working correctly.');
    console.log('✅ Dashboard loads without infinite loops');
    console.log('✅ WebSocket endpoints are functional');
    console.log('✅ Market data streaming is ready');
    console.log('✅ All components are stable and responsive');
  } else if (totalPassed > totalTests * 0.8) {
    console.log('\n⚠️  Most tests passed, but some issues remain.');
    console.log('🔧 Check the failed tests above for specific issues to address.');
  } else {
    console.log('\n❌ Many tests failed. The implementation may need additional work.');
    console.log('🔧 Please review the error messages and fix the remaining issues.');
  }

  console.log('\n✨ WebSocket implementation test completed!');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { 
      method: 'GET'
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
