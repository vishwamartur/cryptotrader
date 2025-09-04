#!/usr/bin/env node

/**
 * Test Direct Delta Exchange WebSocket Connection
 * Validates connection to official Delta Exchange WebSocket endpoints
 */

const WebSocket = require('ws');
const crypto = require('crypto');

// Configuration
const DELTA_WS_URL = 'wss://socket.india.delta.exchange';
const API_KEY = process.env.DELTA_API_KEY;
const API_SECRET = process.env.DELTA_API_SECRET;

console.log('🚀 Testing Direct Delta Exchange WebSocket Connection');
console.log('====================================================');
console.log(`WebSocket URL: ${DELTA_WS_URL}`);
console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'Not provided'}`);
console.log(`API Secret: ${API_SECRET ? 'Provided' : 'Not provided'}`);
console.log('');

async function testDirectWebSocketConnection() {
  return new Promise((resolve, reject) => {
    console.log('📡 Connecting to Delta Exchange WebSocket...');
    
    const ws = new WebSocket(DELTA_WS_URL);
    let connectionTimeout;
    let authTimeout;
    let isAuthenticated = false;
    let hasReceivedData = false;

    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      console.log('❌ Connection timeout after 10 seconds');
      ws.close();
      resolve({
        success: false,
        error: 'Connection timeout',
        details: 'Failed to establish WebSocket connection within 10 seconds'
      });
    }, 10000);

    ws.on('open', async () => {
      console.log('✅ WebSocket connection established');
      clearTimeout(connectionTimeout);

      // Test public data subscription first (no auth required)
      console.log('📊 Subscribing to public market data...');
      const publicSubscription = {
        type: 'subscribe',
        payload: {
          channels: [
            {
              name: 'v2/ticker',
              symbols: ['BTCUSD']
            }
          ]
        }
      };

      ws.send(JSON.stringify(publicSubscription));

      // If we have API credentials, test authentication
      if (API_KEY && API_SECRET) {
        console.log('🔐 Testing authentication...');
        
        try {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const method = 'GET';
          const path = '/live';
          const body = '';

          const signature = crypto
            .createHmac('sha256', API_SECRET)
            .update(method + timestamp + path + body)
            .digest('hex');

          const authMessage = {
            type: 'auth',
            payload: {
              api_key: API_KEY,
              signature: signature,
              timestamp: timestamp
            }
          };

          ws.send(JSON.stringify(authMessage));

          // Set auth timeout
          authTimeout = setTimeout(() => {
            console.log('⚠️  Authentication timeout - continuing with public data only');
          }, 5000);

        } catch (error) {
          console.error('❌ Authentication setup failed:', error.message);
        }
      } else {
        console.log('ℹ️  No API credentials - testing public data only');
      }

      // Set data timeout
      setTimeout(() => {
        if (!hasReceivedData) {
          console.log('⚠️  No data received within 15 seconds');
          ws.close();
          resolve({
            success: true,
            authenticated: isAuthenticated,
            receivedData: false,
            details: 'Connection established but no data received'
          });
        }
      }, 15000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        hasReceivedData = true;
        
        console.log('📨 Received message type:', message.type || 'unknown');
        
        if (message.type === 'auth') {
          clearTimeout(authTimeout);
          if (message.success) {
            console.log('✅ Authentication successful');
            isAuthenticated = true;
          } else {
            console.log('❌ Authentication failed:', message.error || 'Unknown error');
          }
        } else if (message.type === 'subscriptions') {
          console.log('✅ Subscription confirmed:', message.payload?.channels?.length || 0, 'channels');
        } else if (message.type === 'v2/ticker' || message.type === 'ticker') {
          console.log('📈 Market data received for:', message.symbol || 'unknown symbol');
          console.log('   Price:', message.price || 'N/A');
          console.log('   Change:', message.change || 'N/A');
          
          // Success - we received market data
          ws.close();
          resolve({
            success: true,
            authenticated: isAuthenticated,
            receivedData: true,
            marketData: {
              symbol: message.symbol,
              price: message.price,
              change: message.change
            },
            details: 'Successfully received real-time market data'
          });
        } else {
          console.log('📋 Other message:', JSON.stringify(message, null, 2).substring(0, 200));
        }
      } catch (error) {
        console.error('❌ Failed to parse message:', error.message);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      clearTimeout(connectionTimeout);
      clearTimeout(authTimeout);
      resolve({
        success: false,
        error: error.message,
        details: 'WebSocket connection error'
      });
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 Connection closed: ${code} - ${reason || 'No reason provided'}`);
      clearTimeout(connectionTimeout);
      clearTimeout(authTimeout);
      
      if (!hasReceivedData) {
        resolve({
          success: false,
          error: 'Connection closed without receiving data',
          details: `WebSocket closed with code ${code}`
        });
      }
    });
  });
}

// Run the test
testDirectWebSocketConnection()
  .then(result => {
    console.log('\n🎯 Test Results');
    console.log('===============');
    console.log('Success:', result.success ? '✅' : '❌');
    console.log('Authenticated:', result.authenticated ? '✅' : '❌');
    console.log('Received Data:', result.receivedData ? '✅' : '❌');
    console.log('Details:', result.details);
    
    if (result.marketData) {
      console.log('\n📊 Market Data Sample:');
      console.log('Symbol:', result.marketData.symbol);
      console.log('Price:', result.marketData.price);
      console.log('Change:', result.marketData.change);
    }
    
    if (result.error) {
      console.log('Error:', result.error);
    }

    console.log('\n🎉 Direct Delta Exchange WebSocket Connection Test Complete');
    
    if (result.success && result.receivedData) {
      console.log('✅ SUCCESS: Direct WebSocket connection to Delta Exchange is working!');
      process.exit(0);
    } else {
      console.log('⚠️  PARTIAL SUCCESS: Connection established but issues detected');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  });
