#!/usr/bin/env node

/**
 * Delta Exchange Authentication Test Script
 * Tests the authentication fixes and credential validation
 */

const baseUrl = 'http://localhost:3000';

async function testAuthenticationEndpoints() {
  console.log('🔐 Testing Delta Exchange Authentication');
  console.log('=====================================\n');

  const tests = [
    {
      name: 'Test Connection (GET)',
      url: '/api/delta/test-connection',
      method: 'GET'
    },
    {
      name: 'Comprehensive Test (POST)',
      url: '/api/delta/test-connection',
      method: 'POST'
    },
    {
      name: 'Validate Credentials (GET)',
      url: '/api/delta/validate-credentials',
      method: 'GET'
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 ${test.name}`);
      
      const response = await fetch(`${baseUrl}${test.url}`, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`   ✅ Success: ${data.message}`);
        if (data.data?.apiKeyMasked) {
          console.log(`   🔑 API Key: ${data.data.apiKeyMasked}`);
        }
        if (data.data?.balanceCount !== undefined) {
          console.log(`   💰 Balance Count: ${data.data.balanceCount}`);
        }
        if (data.data?.productsCount !== undefined) {
          console.log(`   📊 Products Count: ${data.data.productsCount}`);
        }
        if (data.validationDetails) {
          console.log(`   🔍 Validation Details:`);
          Object.entries(data.validationDetails).forEach(([key, value]) => {
            console.log(`      ${key}: ${value ? '✅' : '❌'}`);
          });
        }
        successCount++;
      } else {
        console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`);
        console.log(`   📝 Details: ${data.details || 'No details'}`);
        if (data.suggestions && data.suggestions.length > 0) {
          console.log(`   💡 Suggestions:`);
          data.suggestions.forEach((suggestion, index) => {
            console.log(`      ${index + 1}. ${suggestion}`);
          });
        }
        errorCount++;
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
      errorCount++;
      console.log('');
    }
  }

  console.log('📊 Authentication Test Results:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📈 Success Rate: ${((successCount / tests.length) * 100).toFixed(1)}%`);

  return { successCount, errorCount, total: tests.length };
}

async function testCredentialValidation() {
  console.log('\n🔍 Testing Credential Validation with Sample Data');
  console.log('================================================\n');

  const testCases = [
    {
      name: 'Invalid API Key Format',
      apiKey: 'invalid_key',
      apiSecret: 'valid_secret_that_is_long_enough_to_pass_format_validation'
    },
    {
      name: 'Invalid API Secret Format',
      apiKey: 'valid_api_key_format_test',
      apiSecret: 'short'
    },
    {
      name: 'Both Invalid',
      apiKey: 'bad',
      apiSecret: 'bad'
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`🧪 ${testCase.name}`);
      
      const response = await fetch(`${baseUrl}/api/delta/validate-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: testCase.apiKey,
          apiSecret: testCase.apiSecret
        })
      });

      const data = await response.json();

      if (data.validationDetails) {
        console.log(`   🔍 Validation Results:`);
        Object.entries(data.validationDetails).forEach(([key, value]) => {
          console.log(`      ${key}: ${value ? '✅' : '❌'}`);
        });
      }

      if (data.suggestions && data.suggestions.length > 0) {
        console.log(`   💡 Suggestions:`);
        data.suggestions.slice(0, 3).forEach((suggestion, index) => {
          console.log(`      ${index + 1}. ${suggestion}`);
        });
      }

      console.log('');
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
      console.log('');
    }
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
  console.log('🚀 Starting Delta Exchange Authentication Tests...\n');

  // Test server health first
  await testServerHealth();

  // Test authentication endpoints
  const authResults = await testAuthenticationEndpoints();

  // Test credential validation
  await testCredentialValidation();

  console.log('\n📋 Summary:');
  if (authResults.successCount === authResults.total) {
    console.log('🎉 All authentication tests passed!');
    console.log('✅ Delta Exchange API authentication is working correctly.');
  } else if (authResults.successCount > 0) {
    console.log('⚠️  Some authentication tests passed, some failed.');
    console.log('🔧 Check the error messages above for troubleshooting steps.');
  } else {
    console.log('❌ All authentication tests failed.');
    console.log('🔧 Please check your Delta Exchange API credentials and configuration.');
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
