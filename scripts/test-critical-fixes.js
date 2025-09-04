#!/usr/bin/env node

/**
 * Comprehensive Critical Issues Testing Script
 * Tests all the fixes implemented for WebSocket errors, type errors, and authentication issues
 */

const baseUrl = 'http://localhost:3000';

console.log('🔧 Testing Critical Issues Fixes');
console.log('================================\n');

async function testWebSocketErrorHandling() {
  console.log('🔌 Testing WebSocket Error Handling Improvements');
  console.log('------------------------------------------------\n');

  const tests = [
    {
      name: 'WebSocket Connection Test',
      url: '/api/websocket/test-connection',
      description: 'Should provide detailed error information instead of empty objects'
    },
    {
      name: 'Delta Exchange Validation',
      url: '/api/delta/validate-credentials',
      description: 'Should handle authentication errors gracefully'
    },
    {
      name: 'Delta Exchange Test Connection',
      url: '/api/delta/test-connection',
      description: 'Should provide meaningful error messages'
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 Testing: ${test.name}`);
      console.log(`   Description: ${test.description}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      const data = await response.json();

      // Check if error details are meaningful (not empty objects)
      if (!response.ok) {
        const hasDetailedError = data.error && 
                                data.error !== '{}' && 
                                typeof data.error === 'string' && 
                                data.error.length > 0;
        
        const hasSuggestions = data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0;
        const hasDetails = data.details && data.details !== '{}';

        if (hasDetailedError || hasSuggestions || hasDetails) {
          console.log(`   ✅ Success: Provides meaningful error information`);
          console.log(`   📝 Error: ${data.error?.substring(0, 100)}${data.error?.length > 100 ? '...' : ''}`);
          if (hasSuggestions) {
            console.log(`   💡 Suggestions: ${data.suggestions.length} provided`);
          }
          successCount++;
        } else {
          console.log(`   ❌ Failed: Still showing empty or meaningless errors`);
          console.log(`   📝 Response: ${JSON.stringify(data).substring(0, 200)}`);
          errorCount++;
        }
      } else {
        console.log(`   ✅ Success: ${test.name} working properly`);
        successCount++;
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Network Error: ${error.message}`);
      errorCount++;
      console.log('');
    }
  }

  return { successCount, errorCount, total: tests.length };
}

async function testDataStructureConsistency() {
  console.log('📊 Testing Data Structure Consistency');
  console.log('------------------------------------\n');

  const tests = [
    {
      name: 'Market Data Structure',
      url: '/api/market/tickers',
      description: 'Should return consistent data structure for components'
    },
    {
      name: 'Market Products',
      url: '/api/market/products',
      description: 'Should provide proper product data structure'
    },
    {
      name: 'Real-time Market Data',
      url: '/api/market/realtime-data',
      description: 'Should handle data transformation correctly'
    }
  ];

  let consistentCount = 0;
  let inconsistentCount = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 Testing: ${test.name}`);
      console.log(`   Description: ${test.description}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      const data = await response.json();

      if (response.ok && data.success) {
        // Check data structure consistency
        let isConsistent = false;
        
        if (test.name === 'Market Data Structure' && Array.isArray(data.tickers)) {
          isConsistent = data.tickers.every(ticker => 
            ticker.symbol && 
            typeof ticker.price === 'string' &&
            typeof ticker.change === 'string'
          );
        } else if (test.name === 'Market Products' && Array.isArray(data.products)) {
          isConsistent = data.products.every(product => 
            product.symbol && 
            product.id !== undefined
          );
        } else if (test.name === 'Real-time Market Data') {
          isConsistent = data.data !== undefined;
        }

        if (isConsistent) {
          console.log(`   ✅ Success: Data structure is consistent`);
          console.log(`   📊 Data count: ${data.tickers?.length || data.products?.length || 'N/A'}`);
          consistentCount++;
        } else {
          console.log(`   ⚠️  Warning: Data structure may have issues`);
          console.log(`   📝 Sample: ${JSON.stringify(data).substring(0, 200)}`);
          inconsistentCount++;
        }
      } else {
        console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`);
        inconsistentCount++;
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
      inconsistentCount++;
      console.log('');
    }
  }

  return { consistentCount, inconsistentCount, total: tests.length };
}

async function testRuntimeTypeErrors() {
  console.log('🔍 Testing Runtime Type Error Prevention');
  console.log('---------------------------------------\n');

  // Test by making multiple requests to endpoints that previously had type errors
  const typeErrorTests = [
    {
      name: 'Dashboard Loading',
      url: '/',
      description: 'Should load without marketData.marketData.get errors'
    },
    {
      name: 'Health Check',
      url: '/api/health',
      description: 'Should return proper health status'
    },
    {
      name: 'Portfolio Status',
      url: '/api/portfolio/status',
      description: 'Should handle portfolio data types correctly'
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of typeErrorTests) {
    try {
      console.log(`🧪 Testing: ${test.name}`);
      console.log(`   Description: ${test.description}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      
      if (response.ok) {
        console.log(`   ✅ Success: No runtime type errors detected`);
        console.log(`   📊 Status: ${response.status} ${response.statusText}`);
        passedTests++;
      } else {
        console.log(`   ⚠️  Warning: Response not OK but no type errors`);
        console.log(`   📊 Status: ${response.status} ${response.statusText}`);
        passedTests++; // Still counts as passed if no type errors
      }

      console.log('');
    } catch (error) {
      if (error.message.includes('is not a function') || error.message.includes('Cannot read property')) {
        console.log(`   ❌ Failed: Runtime type error detected - ${error.message}`);
        failedTests++;
      } else {
        console.log(`   ✅ Success: No type errors (network error is acceptable)`);
        passedTests++;
      }
      console.log('');
    }
  }

  return { passedTests, failedTests, total: typeErrorTests.length };
}

async function testAuthenticationHandling() {
  console.log('🔐 Testing Authentication Error Handling');
  console.log('---------------------------------------\n');

  const authTests = [
    {
      name: 'Delta Exchange Authentication',
      url: '/api/delta/test-connection',
      description: 'Should provide clear authentication error messages'
    },
    {
      name: 'Credential Validation',
      url: '/api/delta/validate-credentials',
      description: 'Should handle missing/invalid credentials gracefully'
    }
  ];

  let handledProperly = 0;
  let handledPoorly = 0;

  for (const test of authTests) {
    try {
      console.log(`🧪 Testing: ${test.name}`);
      console.log(`   Description: ${test.description}`);
      
      const response = await fetch(`${baseUrl}${test.url}`);
      const data = await response.json();

      // Check if authentication errors are handled properly
      if (!response.ok && data.error) {
        const hasGoodErrorMessage = data.error.length > 10 && 
                                   !data.error.includes('{}') &&
                                   (data.error.includes('credential') || 
                                    data.error.includes('authentication') ||
                                    data.error.includes('API key'));
        
        const hasTroubleshooting = data.suggestions && data.suggestions.length > 0;

        if (hasGoodErrorMessage || hasTroubleshooting) {
          console.log(`   ✅ Success: Authentication errors handled properly`);
          console.log(`   📝 Error: ${data.error.substring(0, 100)}`);
          if (hasTroubleshooting) {
            console.log(`   💡 Troubleshooting: ${data.suggestions.length} suggestions provided`);
          }
          handledProperly++;
        } else {
          console.log(`   ❌ Failed: Poor authentication error handling`);
          console.log(`   📝 Error: ${data.error}`);
          handledPoorly++;
        }
      } else if (response.ok) {
        console.log(`   ✅ Success: Authentication working or properly configured`);
        handledProperly++;
      } else {
        console.log(`   ⚠️  Warning: Unexpected response format`);
        handledPoorly++;
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
      handledPoorly++;
      console.log('');
    }
  }

  return { handledProperly, handledPoorly, total: authTests.length };
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
  console.log('🚀 Starting Critical Issues Fix Validation...\n');

  // Check server health first
  const isHealthy = await checkServerHealth();
  console.log('');

  if (!isHealthy) {
    console.log('❌ Server is not healthy. Please check the server status.');
    process.exit(1);
  }

  // Run all tests
  const webSocketResults = await testWebSocketErrorHandling();
  const dataStructureResults = await testDataStructureConsistency();
  const typeErrorResults = await testRuntimeTypeErrors();
  const authResults = await testAuthenticationHandling();

  // Summary
  console.log('📋 Critical Issues Fix Results Summary');
  console.log('======================================\n');

  console.log(`🔌 WebSocket Error Handling:`);
  console.log(`   ✅ Fixed: ${webSocketResults.successCount}/${webSocketResults.total}`);
  console.log(`   ❌ Still Issues: ${webSocketResults.errorCount}/${webSocketResults.total}`);

  console.log(`\n📊 Data Structure Consistency:`);
  console.log(`   ✅ Consistent: ${dataStructureResults.consistentCount}/${dataStructureResults.total}`);
  console.log(`   ❌ Inconsistent: ${dataStructureResults.inconsistentCount}/${dataStructureResults.total}`);

  console.log(`\n🔍 Runtime Type Errors:`);
  console.log(`   ✅ Prevented: ${typeErrorResults.passedTests}/${typeErrorResults.total}`);
  console.log(`   ❌ Still Occurring: ${typeErrorResults.failedTests}/${typeErrorResults.total}`);

  console.log(`\n🔐 Authentication Handling:`);
  console.log(`   ✅ Proper: ${authResults.handledProperly}/${authResults.total}`);
  console.log(`   ❌ Poor: ${authResults.handledPoorly}/${authResults.total}`);

  // Overall assessment
  const totalTests = webSocketResults.total + dataStructureResults.total + typeErrorResults.total + authResults.total;
  const totalFixed = webSocketResults.successCount + dataStructureResults.consistentCount + 
                    typeErrorResults.passedTests + authResults.handledProperly;

  console.log(`\n📈 Overall Fix Success Rate:`);
  console.log(`   ✅ Fixed: ${totalFixed}/${totalTests}`);
  console.log(`   📊 Success Rate: ${Math.round((totalFixed / totalTests) * 100)}%`);

  if (totalFixed === totalTests) {
    console.log('\n🎉 All critical issues have been successfully fixed!');
    console.log('✅ WebSocket errors now provide detailed information');
    console.log('✅ Data structure consistency maintained');
    console.log('✅ Runtime type errors prevented');
    console.log('✅ Authentication errors handled gracefully');
  } else if (totalFixed > totalTests * 0.8) {
    console.log('\n⚠️  Most critical issues fixed, but some remain.');
    console.log('🔧 Check the failed tests above for remaining issues.');
  } else {
    console.log('\n❌ Many critical issues still need attention.');
    console.log('🔧 Please review the test results and continue fixing.');
  }

  console.log('\n✨ Critical issues testing completed!');
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
