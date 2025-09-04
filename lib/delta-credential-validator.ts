/**
 * Delta Exchange Credential Validator
 * Validates and tests Delta Exchange API credentials
 */

import { createDeltaExchangeAPI } from './delta-exchange';

export interface CredentialValidationResult {
  isValid: boolean;
  error?: string;
  details?: {
    apiKeyFormat: boolean;
    apiSecretFormat: boolean;
    connectionTest: boolean;
    authenticationTest: boolean;
    permissionsTest: boolean;
  };
  suggestions?: string[];
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // Delta Exchange API keys are typically alphanumeric strings
  // They should be at least 20 characters long
  return apiKey.length >= 20 && /^[a-zA-Z0-9]+$/.test(apiKey);
}

/**
 * Validate API secret format
 */
export function validateApiSecretFormat(apiSecret: string): boolean {
  if (!apiSecret || typeof apiSecret !== 'string') {
    return false;
  }
  
  // Delta Exchange API secrets are typically longer alphanumeric strings
  // They should be at least 40 characters long
  return apiSecret.length >= 40 && /^[a-zA-Z0-9]+$/.test(apiSecret);
}

/**
 * Test basic connection to Delta Exchange API
 */
export async function testConnection(): Promise<boolean> {
  try {
    const response = await fetch('https://api.delta.exchange/v2/products', {
      method: 'GET',
      headers: {
        'User-Agent': 'CryptoTrader/1.0',
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

/**
 * Test authentication with provided credentials
 */
export async function testAuthentication(apiKey: string, apiSecret: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const deltaAPI = createDeltaExchangeAPI(apiKey, apiSecret);
    
    // Try to get balance (requires authentication)
    const result = await deltaAPI.getBalance();
    
    return {
      success: result.success,
      error: result.success ? undefined : 'Authentication failed'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown authentication error'
    };
  }
}

/**
 * Test API permissions
 */
export async function testPermissions(apiKey: string, apiSecret: string): Promise<{
  balance: boolean;
  positions: boolean;
  orders: boolean;
  trading: boolean;
}> {
  const deltaAPI = createDeltaExchangeAPI(apiKey, apiSecret);
  const results = {
    balance: false,
    positions: false,
    orders: false,
    trading: false
  };
  
  try {
    const balanceResult = await deltaAPI.getBalance();
    results.balance = balanceResult.success;
  } catch (error) {
    console.log('Balance permission test failed:', error);
  }
  
  try {
    const positionsResult = await deltaAPI.getPositions();
    results.positions = positionsResult.success;
  } catch (error) {
    console.log('Positions permission test failed:', error);
  }
  
  try {
    const ordersResult = await deltaAPI.getOrders();
    results.orders = ordersResult.success;
  } catch (error) {
    console.log('Orders permission test failed:', error);
  }
  
  // Note: We don't test actual trading to avoid placing real orders
  results.trading = results.balance && results.positions && results.orders;
  
  return results;
}

/**
 * Comprehensive credential validation
 */
export async function validateCredentials(apiKey: string, apiSecret: string): Promise<CredentialValidationResult> {
  const result: CredentialValidationResult = {
    isValid: false,
    details: {
      apiKeyFormat: false,
      apiSecretFormat: false,
      connectionTest: false,
      authenticationTest: false,
      permissionsTest: false
    },
    suggestions: []
  };
  
  // 1. Validate API key format
  result.details.apiKeyFormat = validateApiKeyFormat(apiKey);
  if (!result.details.apiKeyFormat) {
    result.suggestions.push('API key format is invalid. Ensure it contains only alphanumeric characters and is at least 20 characters long.');
  }
  
  // 2. Validate API secret format
  result.details.apiSecretFormat = validateApiSecretFormat(apiSecret);
  if (!result.details.apiSecretFormat) {
    result.suggestions.push('API secret format is invalid. Ensure it contains only alphanumeric characters and is at least 40 characters long.');
  }
  
  // 3. Test basic connection
  result.details.connectionTest = await testConnection();
  if (!result.details.connectionTest) {
    result.suggestions.push('Cannot connect to Delta Exchange API. Check your internet connection.');
    result.error = 'Connection test failed';
    return result;
  }
  
  // 4. Test authentication
  const authTest = await testAuthentication(apiKey, apiSecret);
  result.details.authenticationTest = authTest.success;
  if (!result.details.authenticationTest) {
    result.error = authTest.error;
    result.suggestions.push('Authentication failed. Verify your API key and secret are correct.');
    return result;
  }
  
  // 5. Test permissions
  const permissions = await testPermissions(apiKey, apiSecret);
  result.details.permissionsTest = permissions.balance && permissions.positions && permissions.orders;
  
  if (!permissions.balance) {
    result.suggestions.push('API key lacks balance reading permissions.');
  }
  if (!permissions.positions) {
    result.suggestions.push('API key lacks position reading permissions.');
  }
  if (!permissions.orders) {
    result.suggestions.push('API key lacks order reading permissions.');
  }
  
  // Overall validation
  result.isValid = result.details.apiKeyFormat && 
                   result.details.apiSecretFormat && 
                   result.details.connectionTest && 
                   result.details.authenticationTest &&
                   result.details.permissionsTest;
  
  if (result.isValid) {
    result.suggestions = ['Credentials are valid and have all required permissions.'];
  }
  
  return result;
}

/**
 * Get credential validation suggestions
 */
export function getCredentialSuggestions(error: string): string[] {
  const suggestions: string[] = [];
  
  if (error.includes('invalid_api_key')) {
    suggestions.push(
      'Get your API credentials from: https://www.delta.exchange/app/api-management',
      'Ensure you\'re using production keys (not testnet)',
      'Check that your API key hasn\'t expired',
      'Verify the API key format is correct (no extra spaces)'
    );
  }
  
  if (error.includes('invalid_signature')) {
    suggestions.push(
      'Verify your API secret is correct',
      'Check your system time is synchronized',
      'Ensure no extra spaces in your API credentials',
      'Try regenerating your API key and secret'
    );
  }
  
  if (error.includes('insufficient_permissions')) {
    suggestions.push(
      'Enable trading permissions for your API key',
      'Check that your API key has read permissions for balance, positions, and orders',
      'Verify your account is verified and in good standing'
    );
  }
  
  if (suggestions.length === 0) {
    suggestions.push(
      'Check your internet connection',
      'Verify Delta Exchange service is available',
      'Try regenerating your API credentials',
      'Contact Delta Exchange support if the issue persists'
    );
  }
  
  return suggestions;
}
