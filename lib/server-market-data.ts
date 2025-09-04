/**
 * Server-side Market Data Provider
 * Handles Delta Exchange API connections safely on the server-side
 */

import { getDeltaCredentials, createDeltaExchangeAPIFromEnv } from './delta-exchange';
import { createDeltaWebSocketClient } from './delta-websocket-client';
import { createDeltaWebSocketAPI } from './delta-websocket-api';

// Server-side singleton for market data
let serverMarketDataManager: any = null;

/**
 * Get or create server-side market data manager
 * This ensures WebSocket connections are only created server-side
 */
export function getServerMarketDataManager() {
  // Only initialize on server-side
  if (typeof window !== 'undefined') {
    throw new Error('Server market data manager cannot be used on client-side');
  }

  if (!serverMarketDataManager) {
    try {
      const credentials = getDeltaCredentials();
      const restClient = createDeltaExchangeAPIFromEnv();
      
      // Create WebSocket client with explicit credentials
      const wsClient = createDeltaWebSocketClient({
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret
      });
      
      const wsAPI = createDeltaWebSocketAPI(wsClient, restClient);
      
      serverMarketDataManager = {
        wsClient,
        wsAPI,
        restClient,
        credentials
      };
      
      console.log('[ServerMarketData] Initialized successfully');
    } catch (error) {
      console.error('[ServerMarketData] Failed to initialize:', error);
      throw error;
    }
  }

  return serverMarketDataManager;
}

/**
 * Get market data for client-side consumption
 * Returns serializable data without WebSocket connections
 */
export async function getMarketDataForClient() {
  try {
    const manager = getServerMarketDataManager();
    const restClient = manager.restClient;
    
    // Fetch current market data
    const [products, btcTicker, ethTicker] = await Promise.all([
      restClient.getProducts(),
      restClient.getTicker('BTCUSDT'),
      restClient.getTicker('ETHUSDT')
    ]);

    return {
      products: products.success ? products.result : [],
      tickers: {
        BTCUSDT: btcTicker.success ? btcTicker.result : null,
        ETHUSDT: ethTicker.success ? ethTicker.result : null
      },
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[ServerMarketData] Failed to fetch market data:', error);
    return {
      products: [],
      tickers: {},
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test server-side connection
 */
export async function testServerConnection() {
  try {
    const manager = getServerMarketDataManager();
    const restClient = manager.restClient;
    
    const balance = await restClient.getBalance();
    const products = await restClient.getProducts();
    
    return {
      success: true,
      balanceCount: balance.success ? balance.result?.length || 0 : 0,
      productsCount: products.success ? products.result?.length || 0 : 0,
      credentials: {
        apiKeyMasked: `${manager.credentials.apiKey.substring(0, 8)}...${manager.credentials.apiKey.slice(-4)}`
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
