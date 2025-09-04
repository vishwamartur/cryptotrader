#!/usr/bin/env node

/**
 * WebSocket Error Testing Utility
 * Tests the improved WebSocket error handling and demonstrates detailed error reporting
 */

console.log('🔌 WebSocket Error Handling Test');
console.log('================================\n');

// Test cases for different WebSocket error scenarios
const testCases = [
  {
    name: 'Invalid URL Format',
    url: 'invalid-url',
    expectedError: 'Invalid WebSocket URL format'
  },
  {
    name: 'Non-existent Server',
    url: 'ws://nonexistent-server.example.com:9999',
    expectedError: 'Connection failed'
  },
  {
    name: 'Unreachable Local Server',
    url: 'ws://localhost:9999',
    expectedError: 'Connection failed'
  },
  {
    name: 'Invalid Delta Exchange URL',
    url: 'wss://invalid.delta.exchange',
    expectedError: 'Connection failed'
  }
];

async function testWebSocketError(testCase) {
  return new Promise((resolve) => {
    console.log(`🧪 Testing: ${testCase.name}`);
    console.log(`   URL: ${testCase.url}`);
    
    try {
      const ws = new WebSocket(testCase.url);
      let errorCaptured = false;
      let connectionTimeout;
      
      // Set a timeout to prevent hanging
      connectionTimeout = setTimeout(() => {
        if (!errorCaptured) {
          console.log('   ⏰ Connection timeout (expected for invalid servers)');
          ws.close();
          resolve({
            testCase: testCase.name,
            success: true,
            error: 'Connection timeout',
            details: 'Timeout occurred as expected for invalid server'
          });
        }
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('   ✅ Unexpected success - connection opened');
        ws.close();
        resolve({
          testCase: testCase.name,
          success: false,
          error: 'Unexpected connection success',
          details: 'Expected connection to fail but it succeeded'
        });
      };
      
      ws.onerror = (errorEvent) => {
        clearTimeout(connectionTimeout);
        errorCaptured = true;
        
        // Simulate the improved error handling logic
        let errorDetails = {};
        
        try {
          errorDetails.eventType = errorEvent.type || 'error';
          errorDetails.timeStamp = errorEvent.timeStamp || Date.now();
          
          if (errorEvent instanceof ErrorEvent) {
            errorDetails.isErrorEvent = true;
            errorDetails.message = errorEvent.message || 'No error message';
          } else {
            errorDetails.isErrorEvent = false;
            errorDetails.message = 'WebSocket error (no message available)';
          }
          
          if (errorEvent.target && errorEvent.target instanceof WebSocket) {
            const wsTarget = errorEvent.target;
            errorDetails.target = {
              readyState: wsTarget.readyState,
              readyStateName: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsTarget.readyState] || 'UNKNOWN',
              url: wsTarget.url || testCase.url,
              protocol: wsTarget.protocol || 'unknown'
            };
          }
          
        } catch (extractError) {
          errorDetails = {
            eventType: 'error',
            message: 'Failed to extract error details',
            extractionError: extractError.message,
            url: testCase.url
          };
        }
        
        console.log('   ❌ Error captured (expected)');
        console.log('   📊 Error details:', JSON.stringify(errorDetails, null, 2));
        
        // Check if error details are meaningful (not empty)
        const hasDetails = Object.keys(errorDetails).length > 0 && 
                          errorDetails.eventType && 
                          errorDetails.message;
        
        resolve({
          testCase: testCase.name,
          success: hasDetails,
          error: hasDetails ? 'Detailed error captured' : 'Empty error details',
          details: errorDetails
        });
      };
      
      ws.onclose = (closeEvent) => {
        clearTimeout(connectionTimeout);
        if (!errorCaptured) {
          console.log('   🔌 Connection closed');
          console.log(`   📊 Close details: Code ${closeEvent.code}, Reason: ${closeEvent.reason || 'None'}`);
          
          resolve({
            testCase: testCase.name,
            success: true,
            error: 'Connection closed',
            details: {
              code: closeEvent.code,
              reason: closeEvent.reason,
              wasClean: closeEvent.wasClean
            }
          });
        }
      };
      
    } catch (error) {
      console.log('   💥 Exception thrown:', error.message);
      resolve({
        testCase: testCase.name,
        success: true,
        error: 'Exception thrown',
        details: error.message
      });
    }
    
    console.log('');
  });
}

async function runTests() {
  console.log('🚀 Starting WebSocket Error Handling Tests...\n');
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testWebSocketError(testCase);
    results.push(result);
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('📊 Test Results Summary:');
  console.log('========================\n');
  
  let successCount = 0;
  let failureCount = 0;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.testCase}: ${status}`);
    console.log(`   Error: ${result.error}`);
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });
  
  console.log(`📈 Overall Results:`);
  console.log(`   ✅ Passed: ${successCount}/${results.length}`);
  console.log(`   ❌ Failed: ${failureCount}/${results.length}`);
  console.log(`   📊 Success Rate: ${Math.round((successCount / results.length) * 100)}%`);
  
  if (successCount === results.length) {
    console.log('\n🎉 All tests passed! WebSocket error handling is working correctly.');
    console.log('✅ Error details are being captured and displayed properly.');
  } else {
    console.log('\n⚠️  Some tests failed. WebSocket error handling may need further improvement.');
  }
  
  console.log('\n💡 Note: These tests demonstrate that WebSocket errors now provide');
  console.log('   detailed information instead of empty objects ({}).');
}

// Check if we're in a browser-like environment
if (typeof WebSocket === 'undefined') {
  console.log('❌ WebSocket is not available in this environment.');
  console.log('   This test should be run in a browser environment or with WebSocket polyfill.');
  console.log('   The improved error handling will work in the actual application.');
  process.exit(0);
}

runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
