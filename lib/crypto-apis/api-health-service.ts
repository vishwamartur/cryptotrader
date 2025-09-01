/**
 * API Health Monitoring Service
 * Tests and monitors all configured API integrations
 */

import { cryptoAPIManager } from './api-manager';
import { sentimentAPIManager } from './sentiment-manager';
import { santimentService } from './santiment-service';
import { pineconeService } from '../ml/services/pinecone-service';

export interface APIHealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'not_configured';
  responseTime?: number;
  lastChecked: string;
  error?: string;
  details?: any;
}

export interface OverallHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  apis: APIHealthStatus[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    notConfigured: number;
  };
}

export class APIHealthService {
  private static instance: APIHealthService;
  private healthCache: Map<string, { status: APIHealthStatus; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minute

  static getInstance(): APIHealthService {
    if (!APIHealthService.instance) {
      APIHealthService.instance = new APIHealthService();
    }
    return APIHealthService.instance;
  }

  private async testAPIWithTimeout<T>(
    apiCall: () => Promise<T>,
    timeoutMs: number = 10000
  ): Promise<{ success: boolean; responseTime: number; data?: T; error?: string }> {
    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      const data = await Promise.race([apiCall(), timeoutPromise]);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        data
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkPerplexityAPI(): Promise<APIHealthStatus> {
    const name = 'Perplexity AI';
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      return {
        name,
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        error: 'API key not configured'
      };
    }

    const result = await this.testAPIWithTimeout(async () => {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{ role: 'user', content: 'Test connection' }],
          max_tokens: 10
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    });

    return {
      name,
      status: result.success ? 'healthy' : 'unhealthy',
      responseTime: result.responseTime,
      lastChecked: new Date().toISOString(),
      error: result.error
    };
  }

  async checkDeltaExchangeAPI(): Promise<APIHealthStatus> {
    const name = 'Delta Exchange';
    const apiKey = process.env.DELTA_API_KEY;
    const baseUrl = process.env.DELTA_BASE_URL || 'https://api.delta.exchange';

    if (!apiKey) {
      return {
        name,
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        error: 'API key not configured'
      };
    }

    const result = await this.testAPIWithTimeout(async () => {
      const response = await fetch(`${baseUrl}/v2/products`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    });

    return {
      name,
      status: result.success ? 'healthy' : 'unhealthy',
      responseTime: result.responseTime,
      lastChecked: new Date().toISOString(),
      error: result.error,
      details: result.success ? { productsCount: result.data?.result?.length || 0 } : undefined
    };
  }

  async checkCryptoDataAPIs(): Promise<APIHealthStatus[]> {
    const results: APIHealthStatus[] = [];

    // Test CoinMarketCap
    if (process.env.COINMARKETCAP_API_KEY) {
      const result = await this.testAPIWithTimeout(async () => {
        const response = await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC', {
          headers: {
            'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY!,
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      });

      results.push({
        name: 'CoinMarketCap',
        status: result.success ? 'healthy' : 'unhealthy',
        responseTime: result.responseTime,
        lastChecked: new Date().toISOString(),
        error: result.error
      });
    } else {
      results.push({
        name: 'CoinMarketCap',
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        error: 'API key not configured'
      });
    }

    // Test CryptoCompare
    if (process.env.CRYPTOCOMPARE_API_KEY) {
      const result = await this.testAPIWithTimeout(async () => {
        const response = await fetch('https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD', {
          headers: {
            'authorization': `Apikey ${process.env.CRYPTOCOMPARE_API_KEY}`,
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      });

      results.push({
        name: 'CryptoCompare',
        status: result.success ? 'healthy' : 'unhealthy',
        responseTime: result.responseTime,
        lastChecked: new Date().toISOString(),
        error: result.error
      });
    } else {
      results.push({
        name: 'CryptoCompare',
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        error: 'API key not configured'
      });
    }

    // Test CoinAPI
    if (process.env.COINAPI_KEY) {
      const result = await this.testAPIWithTimeout(async () => {
        const response = await fetch('https://rest.coinapi.io/v1/exchangerate/BTC/USD', {
          headers: {
            'X-CoinAPI-Key': process.env.COINAPI_KEY!,
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      });

      results.push({
        name: 'CoinAPI',
        status: result.success ? 'healthy' : 'unhealthy',
        responseTime: result.responseTime,
        lastChecked: new Date().toISOString(),
        error: result.error
      });
    } else {
      results.push({
        name: 'CoinAPI',
        status: 'not_configured',
        lastChecked: new Date().toISOString(),
        error: 'API key not configured'
      });
    }

    return results;
  }

  async checkSantimentAPI(): Promise<APIHealthStatus> {
    const name = 'Santiment';
    const isHealthy = await santimentService.healthCheck();

    return {
      name,
      status: isHealthy ? 'healthy' : (process.env.SANTIMENT_API_KEY ? 'unhealthy' : 'not_configured'),
      lastChecked: new Date().toISOString(),
      error: !isHealthy && process.env.SANTIMENT_API_KEY ? 'Health check failed' : undefined
    };
  }

  async checkPineconeAPI(): Promise<APIHealthStatus> {
    const name = 'Pinecone';
    const isHealthy = await pineconeService.healthCheck();

    return {
      name,
      status: isHealthy ? 'healthy' : (process.env.PINECONE_API_KEY ? 'unhealthy' : 'not_configured'),
      lastChecked: new Date().toISOString(),
      error: !isHealthy && process.env.PINECONE_API_KEY ? 'Health check failed' : undefined
    };
  }

  async getOverallHealthReport(): Promise<OverallHealthReport> {
    const apis: APIHealthStatus[] = [];

    // Check all APIs
    const [
      perplexity,
      deltaExchange,
      cryptoAPIs,
      santiment,
      pinecone
    ] = await Promise.all([
      this.checkPerplexityAPI(),
      this.checkDeltaExchangeAPI(),
      this.checkCryptoDataAPIs(),
      this.checkSantimentAPI(),
      this.checkPineconeAPI()
    ]);

    apis.push(perplexity, deltaExchange, ...cryptoAPIs, santiment, pinecone);

    // Calculate summary
    const summary = {
      total: apis.length,
      healthy: apis.filter(api => api.status === 'healthy').length,
      degraded: apis.filter(api => api.status === 'degraded').length,
      unhealthy: apis.filter(api => api.status === 'unhealthy').length,
      notConfigured: apis.filter(api => api.status === 'not_configured').length
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.healthy === summary.total) {
      overallStatus = 'healthy';
    } else if (summary.healthy > summary.unhealthy) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      apis,
      summary
    };
  }

  async testCryptoDataIntegration(): Promise<any> {
    try {
      // Test price data
      const prices = await cryptoAPIManager.getPrices(['BTC', 'ETH']);
      
      // Test market data
      const marketData = await cryptoAPIManager.getMarketData();
      
      // Test sentiment data
      const sentiment = await sentimentAPIManager.getSentiment(['BTC', 'ETH']);

      return {
        success: true,
        results: {
          prices: prices.length,
          marketData: !!marketData,
          sentiment: sentiment.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const apiHealthService = APIHealthService.getInstance();
