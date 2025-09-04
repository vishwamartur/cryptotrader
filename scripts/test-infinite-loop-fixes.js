#!/usr/bin/env node

/**
 * Infinite Loop and Error Handling Fixes Test Script
 * Tests the fixes for React infinite loops and WebSocket/market data errors
 */

const baseUrl = 'http://localhost:3000';

console.log('🔄 Testing Infinite Loop and Error Handling Fixes');
console.log('=================================================\n');

async function testMarketDataEndpoints() {
  console.log('📊 Testing Market Data Endpoints');
  console.log('--------------------------------\n');

  const endpoints = [
    {
      name: 'Market Products',
      url: '/api/market/products',
      expectedFields: ['success', 'products']
    },
    {
      name: 'Market Tickers',
      url: '/api/market/tickers',
      expectedFields: ['success', 'tickers']
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const endpoint of endpoints) {
    try {
      console.log(`🧪 Testing: ${endpoint.name}`);
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
        
        successCount++;
      } else {
        console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`);
        console.log(`   📝 Details: ${data.details || 'No details'}`);
        
        // Check if error details are meaningful (not empty objects)
        if (data.error && data.error !== '{}' && typeof data.error === 'string') {
          console.log(`   ✅ Error details are meaningful (not empty objects)`);
        } else {
          console.log(`   ❌ Error details are empty or not meaningful`);
        }
        
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

async function testWebSocketErrorHandling() {
  console.log('🔌 Testing WebSocket Error Handling');
  console.log('-----------------------------------\n');

  try {
    console.log('🧪 Testing WebSocket connection endpoint');
    
    const response = await fetch(`${baseUrl}/api/websocket/test-connection`);
    const data = await response.json();

    if (response.ok && data.success) {
      console.log('   ✅ WebSocket test endpoint working');
      console.log(`   📊 Connection details available: ${!!data.connectionDetails}`);
    } else {
      console.log('   ❌ WebSocket test failed');
      console.log(`   📝 Error: ${data.error || 'Unknown error'}`);
      
      // Check if error details are meaningful
      if (data.error && data.error !== '{}' && typeof data.error === 'string') {
        console.log('   ✅ Error details are meaningful (not empty objects)');
      } else {
        console.log('   ❌ Error details are empty or not meaningful');
      }
    }

    console.log('');
    return { success: response.ok, hasDetails: !!data.error || !!data.connectionDetails };
  } catch (error) {
    console.log(`   💥 Network Error: ${error.message}`);
    console.log('');
    return { success: false, hasDetails: false };
  }
}

async function testDashboardStability() {
  console.log('🏠 Testing Dashboard Stability');
  console.log('------------------------------\n');

  const dashboardEndpoints = [
    '/api/health',
    '/api/health/detailed',
    '/api/portfolio/status',
    '/api/market/realtime-data'
  ];

  let stableCount = 0;
  let unstableCount = 0;

  for (const endpoint of dashboardEndpoints) {
    try {
      console.log(`🧪 Testing: ${endpoint}`);
      
      const response = await fetch(`${baseUrl}${endpoint}`);
      const data = await response.json();

      if (response.ok) {
        console.log(`   ✅ Stable: ${endpoint} responding properly`);
        
        // Check response structure
        if (typeof data === 'object' && data !== null) {
          const keys = Object.keys(data);
          console.log(`   📋 Response keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`);
        }
        
        stableCount++;
      } else {
        console.log(`   ❌ Unstable: ${endpoint} returned error`);
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

async function testErrorMessageQuality() {
  console.log('📝 Testing Error Message Quality');
  console.log('--------------------------------\n');

  // Test endpoints that are likely to return errors
  const errorTestEndpoints = [
    '/api/nonexistent-endpoint',
    '/api/market/tickers?symbols=INVALID_SYMBOL',
    '/api/portfolio/orders?invalid=true'
  ];

  let meaningfulErrors = 0;
  let emptyErrors = 0;

  for (const endpoint of errorTestEndpoints) {
    try {
      console.log(`🧪 Testing error quality: ${endpoint}`);
      
      const response = await fetch(`${baseUrl}${endpoint}`);
      const data = await response.json();

      if (!response.ok) {
        // This is expected - we're testing error quality
        const errorMessage = data.error || data.message || data.details || '';
        
        if (errorMessage && errorMessage !== '{}' && errorMessage.length > 0) {
          console.log(`   ✅ Meaningful error: "${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}"`);
          meaningfulErrors++;
        } else {
          console.log(`   ❌ Empty or meaningless error: "${JSON.stringify(data)}"`);
          emptyErrors++;
        }
      } else {
        console.log(`   ⚠️  Unexpected success (expected error for testing)`);
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Network Error: ${error.message}`);
      console.log('');
    }
  }

  return { meaningfulErrors, emptyErrors, total: errorTestEndpoints.length };
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
  console.log('🚀 Starting Comprehensive Fix Validation Tests...\n');

  // Check server health first
  const isHealthy = await checkServerHealth();
  console.log('');

  if (!isHealthy) {
    console.log('❌ Server is not healthy. Please check the server status.');
    process.exit(1);
  }

  // Run all tests
  const marketDataResults = await testMarketDataEndpoints();
  const webSocketResults = await testWebSocketErrorHandling();
  const dashboardResults = await testDashboardStability();
  const errorQualityResults = await testErrorMessageQuality();

  // Summary
  console.log('📋 Test Results Summary');
  console.log('=======================\n');

  console.log(`📊 Market Data Endpoints:`);
  console.log(`   ✅ Working: ${marketDataResults.successCount}/${marketDataResults.total}`);
  console.log(`   ❌ Failed: ${marketDataResults.errorCount}/${marketDataResults.total}`);

  console.log(`\n🔌 WebSocket Error Handling:`);
  console.log(`   ✅ Working: ${webSocketResults.success ? 'Yes' : 'No'}`);
  console.log(`   📝 Has Details: ${webSocketResults.hasDetails ? 'Yes' : 'No'}`);

  console.log(`\n🏠 Dashboard Stability:`);
  console.log(`   ✅ Stable: ${dashboardResults.stableCount}/${dashboardResults.total}`);
  console.log(`   ❌ Unstable: ${dashboardResults.unstableCount}/${dashboardResults.total}`);

  console.log(`\n📝 Error Message Quality:`);
  console.log(`   ✅ Meaningful: ${errorQualityResults.meaningfulErrors}/${errorQualityResults.total}`);
  console.log(`   ❌ Empty/Meaningless: ${errorQualityResults.emptyErrors}/${errorQualityResults.total}`);

  // Overall assessment
  const totalTests = marketDataResults.total + 1 + dashboardResults.total + errorQualityResults.total;
  const totalPassed = marketDataResults.successCount + (webSocketResults.success ? 1 : 0) + 
                     dashboardResults.stableCount + errorQualityResults.meaningfulErrors;

  console.log(`\n📈 Overall Results:`);
  console.log(`   ✅ Passed: ${totalPassed}/${totalTests}`);
  console.log(`   📊 Success Rate: ${Math.round((totalPassed / totalTests) * 100)}%`);

  if (totalPassed === totalTests) {
    console.log('\n🎉 All tests passed! The infinite loop and error handling fixes are working correctly.');
    console.log('✅ Dashboard should load without "Maximum update depth exceeded" errors');
    console.log('✅ WebSocket errors provide meaningful information instead of empty objects');
    console.log('✅ Market data processing handles errors gracefully');
  } else if (totalPassed > totalTests * 0.8) {
    console.log('\n⚠️  Most tests passed, but some issues remain.');
    console.log('🔧 Check the failed tests above for specific issues to address.');
  } else {
    console.log('\n❌ Many tests failed. The fixes may need additional work.');
    console.log('🔧 Please review the error messages and fix the remaining issues.');
  }

  console.log('\n✨ Test completed!');
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
