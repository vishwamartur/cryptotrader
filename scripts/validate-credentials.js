#!/usr/bin/env node

/**
 * Credential Validation Script
 * Validates that Delta Exchange API credentials are properly configured
 * This script ensures the application will only run with live credentials
 */

const { getDeltaCredentials, createDeltaExchangeAPIFromEnv } = require('../lib/delta-exchange');

async function validateCredentials() {
  console.log('🔐 Validating Delta Exchange API Credentials\n');

  try {
    // Test 1: Check credential retrieval
    console.log('1. Testing credential retrieval...');
    const credentials = getDeltaCredentials();
    console.log(`   ✅ Credentials found: ${credentials.apiKey.substring(0, 8)}...${credentials.apiKey.slice(-4)}`);

    // Test 2: Test API instance creation
    console.log('\n2. Testing API instance creation...');
    const api = createDeltaExchangeAPIFromEnv();
    console.log(`   ✅ API instance created: ${api.constructor.name}`);

    // Test 3: Test live API connection
    console.log('\n3. Testing live API connection...');
    
    const productsResult = await api.getProducts();
    if (productsResult.success) {
      console.log(`   ✅ Products API: Connected successfully`);
      console.log(`      Available products: ${productsResult.result?.length || 0} instruments`);
    } else {
      console.log(`   ❌ Products API: Failed - ${productsResult.error}`);
      process.exit(1);
    }

    const balanceResult = await api.getBalance();
    if (balanceResult.success) {
      console.log(`   ✅ Balance API: Connected successfully`);
      console.log(`      Account balances: ${balanceResult.result?.length || 0} assets`);
    } else {
      console.log(`   ❌ Balance API: Failed - ${balanceResult.error}`);
      process.exit(1);
    }

    console.log('\n🎉 Credential validation completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • ✅ Delta Exchange API credentials are valid');
    console.log('   • ✅ Live API connection established');
    console.log('   • ✅ Application ready for live trading');
    console.log('\n🚀 The application is configured for live trading only.');

  } catch (error) {
    console.log(`\n❌ Credential validation failed: ${error.message}`);
    console.log('\n💡 To fix this issue:');
    console.log('   1. Get your API credentials from: https://www.delta.exchange/app/api-management');
    console.log('   2. Set DELTA_EXCHANGE_API_KEY in your environment');
    console.log('   3. Set DELTA_EXCHANGE_API_SECRET in your environment');
    console.log('   4. Restart the application');
    console.log('\n⚠️  The application will not start without valid credentials.');
    process.exit(1);
  }
}

// Run the validation
validateCredentials().catch((error) => {
  console.error('\n💥 Unexpected error during validation:', error.message);
  process.exit(1);
});
